import { SEMPRE_SERVER_URL } from "constants/strings"

function formatValue(rawValue) {
  if (typeof rawValue === "undefined") return "";
  // "[[5,5,1,\"Blue\",[]],[5,5,2,\"Red\",[]],[5,4,2,\"Green\",[]]]"
  const value = JSON.parse(rawValue);

  // const valueArray = [[1, 1, 0, "Red", []], [1, 1, 1, "Orange", []]];
  // [ x , y , action , spec ]

  let status = value.status;
  let path =  value.path.map((c) => (
    {
      x: c[0],
      y: c[1],
      action: c[2],
      color: c[3],
      shape: c[4],
      possible: c[5]
    }
  ));
  return {path: path, status: status};
}

function combine(vsTmp, v) {
  let vs = vsTmp;
  if (vs === undefined) {
    vs = {};
    //vs.value = v.value;
    vs.path = v.path;
    vs.paths = [v.path];
    vs.status = v.status;
    vs.formula = v.formula;
    vs.utterance = v.utterance;
    vs.prettyString = v.prettyString;    
    vs.prob = parseFloat(v.prob);
    vs.probs = [v.prob];
    vs.pprob = parseFloat(v.pprob);
    vs.pprobs = [v.pprob];
    vs.score = parseFloat(v.score);
    vs.rank = v.rank;
    vs.count = 1;
    vs.maxprob = parseFloat(v.prob);
    vs.maxpprob = parseFloat(v.pprob);
    vs.error = v.error;
    vs.lines = v.lines;
  } else {
    vs.value = v.value;
    vs.prob += parseFloat(v.prob);
    vs.pprob += parseFloat(v.pprob);
    vs.paths.push(v.path);
    vs.score = Math.max(vs.score, parseFloat(v.score));
    vs.maxprob = Math.max(vs.maxprob, parseFloat(v.prob));
    vs.maxpprob = Math.max(vs.maxpprob, parseFloat(v.pprob));
    vs.rank = Math.min(vs.rank, v.rank);
    vs.probs.push(v.prob);
    vs.count += 1;
    vs.error = v.error;
    vs.lines = v.lines;
  }
  return vs;
}

export function parseSEMPRE(valid) {
  const lstqapairs = [];
  if (valid.length === 0) return undefined;

  for (let i = 0; i < valid.length; i++) {
    const qapair = {};
    try {
      let value = formatValue(valid[i].value);
      qapair.path = value.path;
      qapair.status = value.status;
      qapair.formula = valid[i].formula;
      qapair.score = valid[i].score.toFixed(7);
      qapair.rank = i;
      qapair.prob = valid[i].prob;
      qapair.pprob = valid[i].pprob;
      qapair.utterance = valid[i].utterance;
      qapair.prettyString = valid[i].prettyString;
      lstqapairs.push(qapair);
    } catch (e) {
      lstqapairs.push({ path: [], formula: "", rank: i, error: valid[i].value, score: 0, prob: 0, pprob: 0 })
      alert("This response resulted in an error with our server. Please scroll to another intepretation or try another query. The error message was: " + valid[i].value)
      console.log("ERROR!", e, valid[i].value);
    }
  }

  const nbestdict = lstqapairs.reduce((nbd, nbest) => {
    const mynbd = nbd;
    //const key = JSON.stringify(nbest.value);
    const key = JSON.stringify(nbest.formula);
    mynbd[key] = combine(nbd[key], nbest);
    return mynbd;
  }, {});


  const listqadedup = [];
  for (const key in nbestdict) {
    if ({}.hasOwnProperty.call(nbestdict, key)) {
      listqadedup.push(nbestdict[key]);
    }
  }
  listqadedup.sort((a, b) => b.score - a.score + 1e-3 * (a.rank - b.rank));
  return listqadedup;
}

export function SEMPREquery(cmds, callback) {
  const cmdstr = []
  for (const k in cmds) {
    if ({}.hasOwnProperty.call(cmds, k)) {
      cmdstr.push(`${k}=${encodeURIComponent(cmds[k])}`)
    }
  }

  return fetch(`${SEMPRE_SERVER_URL}/sempre?format=lisp2json&${cmdstr.join("&")}`)
    .then((response) => {
      return response.json()
    })
    .catch((ex) => {
      //console.log("fetch issue?", ex)
    })
}
