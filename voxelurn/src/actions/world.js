import Constants from "constants/actions"
import { SEMPREquery, parseSEMPRE/*, worldToJSON*/ } from "helpers/sempre"
import Logger from "actions/logger"
import { updateRobot, removeRobot } from "helpers/blocks"
import { persistStore } from "redux-persist"
import { getStore } from "../"
import { STATUS } from "constants/strings"
import { worldConfig } from "constants/defaultMap"

function sendContext(history, current_history_idx, sessionId) {
  let contextCommand = "(:context)"

  if (history.length > 0) {
    const idx = current_history_idx >= 0 && current_history_idx < history.length ? current_history_idx : history.length - 1
    const currentState = history[idx].worldMap.map(c => ([c.x, c.y, c.type, c.color, c.shape]));
    //const currentState = worldToJSON(history[idx].worldMap);
    const robot = history[idx].robot;
    const robotContext = [robot.x, robot.y, robot.items];
    const rooms = {};
    for (let k of Object.keys(worldConfig.roomPoints)) {
      rooms[k] = [...worldConfig.roomPoints[k].values()];
    }
    const totalState = JSON.stringify(JSON.stringify({
      robot: robotContext,
      world: currentState,
      rooms: rooms
    }));
    contextCommand = `(:context ${totalState})`;
  }

  const contextCmds = { q: contextCommand, sessionId: sessionId }

  return SEMPREquery(contextCmds)
}

const Actions = {
  setQuery: (query) => {
    return (dispatch) => {
      dispatch({
        type: Constants.SET_QUERY,
        query
      })
    }
  },

  undo: () => {
    return (dispatch, getState) => {
      const { current_history_idx, history } = getState().world

      const idx = current_history_idx !== 0 ? (current_history_idx >= 0 ? current_history_idx - 1 : history.length - 2) : current_history_idx

      dispatch({
        type: Constants.REVERT,
        idx: idx
      })
    }
  },

  redo: () => {
    return (dispatch, getState) => {
      const { current_history_idx, history } = getState().world

      const idx = current_history_idx !== history.length - 1 ? (current_history_idx >= 0 ? current_history_idx + 1 : -1) : current_history_idx

      dispatch({
        type: Constants.REVERT,
        idx: idx
      })
    }
  },

  setStatus: (status) => {
    return (dispatch) => {
      dispatch({
        type: Constants.SET_STATUS,
        status
      })
    }
  },

  tryQuery: (q) => {
    return (dispatch, getState) => {
      const { sessionId } = getState().user
      const { history, current_history_idx } = getState().world

      dispatch({
        type: Constants.SET_STATUS,
        status: STATUS.LOADING
      })
      
      return sendContext(history, current_history_idx, sessionId)
        .then((eh) => {
          //q = processMacros(q);
          const query = `(:q ${JSON.stringify(q)})`
          const cmds = { q: query, sessionId: sessionId }
          console.log("sending query "+query);
          return SEMPREquery(cmds)
            .then((response) => {
            	//console.log("received response: "+JSON.stringify(response));
            	console.log(response);
              if (!response)
                throw new Error("empty_response");

              if (response.lines && response.lines.length > 0) {
                /* Alert any errors in the query */
                alert(response.lines.join("; "))
              }

              const formval = parseSEMPRE(response.candidates)
              console.log(formval);
             

              if (formval === null || formval === undefined) {
                dispatch(Logger.log({ type: "tryFail", msg: { query: q } }))
                return false
              } else {
                /* Remove no-ops */
                //const idx = current_history_idx >= 0 && current_history_idx < history.length ? current_history_idx : history.length - 1

                const responses = formval;
             
                console.log(query);
                dispatch(Logger.log({ type: "try", msg: { query: q, responses: formval.length } }))
                dispatch({
                  type: Constants.TRY_QUERY,
                  responses: responses
                })

                //unparsable utterance, set up the definition
                if (response.stats.unparsableUtterance !== undefined) {
                	dispatch({
                		type: Constants.UNPARSABLE,
                		unparsable: response.stats.unparsableUtterance,
                		
                	})
                }
                else {
                	dispatch({
                		type: Constants.PARSABLE,
                	})
                }
                return true
              }
            })
        })
        .catch((e) => {
          if (e.message === "empty_response") {
            alert("Could not contact server");
          }
          //alert("Query could no be processed by server.");
          //console.log("tryQuery error?", e);
          //console.log(JSON.stringify(e, null, 4));
          console.log(e);
          return null;
        })
    }
  },

  pushToHistory: (el) => {
    return (dispatch) => {
      dispatch({
        type: Constants.ACCEPT,
        el: el
      })
    }
  },

  acceptPath: (text, selectedResp) => {
    return (dispatch, getState) => {
      const { responses, history } = getState().world

      const selected = responses[selectedResp]

      if (selected.error) {
        alert("You can't accept a response with an error in it. Please accept another response or try a different query.")
        dispatch({
          type: Constants.SET_STATUS,
          status: STATUS.TRY
        })
        return
      }

      //dispatch(Logger.log({ type: "accept", msg: { query: text, rank: selected.rank, formula: selected.formula } }))

      // Apply history; maybe I need to identify the history I need to apply to in a different way.
      let currentState = JSON.parse(JSON.stringify(history[history.length - 1]));
      let path = selected.path;
      for (let i = 0; i < path.length; ++i) {
        updateRobot(currentState.worldMap, currentState.robot, i, selected.path, 1);
        removeRobot(currentState.worldMap);
      }

      selected.worldMap = currentState.worldMap;
      selected.robot = currentState.robot;

      dispatch({
        type: Constants.ACCEPT,
        el: { ...selected, text}
      })

      return true
    }
  },

  acceptNone: (text) => {
    return (dispatch, getState) => {
      const { sessionId } = getState().user
      const { responses } = getState().world

      const formulas = responses.reduce((acc, r) => acc.concat(r.formulas), [])

      // Do I need to processMacros() here?
      const query = `(:reject ${JSON.stringify(text)} ${formulas.map(f => JSON.stringify(f)).join(" ")})`
      SEMPREquery({ q: query, sessionId: sessionId }, () => { })
      
      dispatch(Logger.log({ type: "acceptNone", msg: { query: text } }))
    }
  },

  define: (idx) => {
    return (dispatch, getState) => {
      const { sessionId } = getState().user
      const { history, query } = getState().world

      if (idx === history.length - 1) {
        alert("The definition body cannot be empty. If you have tried a command, make sure to accept it first.")
        return
      }
      const text = history[idx] !== undefined ? history[idx].text : ""
      const defineAs = text !== "" ? text : query

      const defineHist = history
          .slice(idx + 1, history.length)
          //.map(h => [processMacros(h.text), h.formula])
          .map(h => [h.text, h.formula])
          .filter(h => h.type !== "pin");

      // scope multiline definitions by default
      let mode = ":def"
      if (defineHist.length <= 1) {
        mode = ":def_ret"
      } else if (defineHist.length === history.length - 2) {
        mode = ":def_iso"
      }

      //const processed = processMacros(defineAs);
      const sempreQuery = `(${mode} "${/*processed*/defineAs}" ${JSON.stringify(JSON.stringify(defineHist))})`
      
      /* Submit the define command */
      SEMPREquery({ q: sempreQuery, sessionId: sessionId })
        .then((r) => {
          if (r.lines && r.lines.length > 0) {
            /* Display errors and quit if there errors */
            alert(`There were error(s) in this definition: ${r.lines.join(", ")}`)
            return
          }

          const { formula: topFormula } = r.candidates[0]

          dispatch(Logger.log({ type: "define", msg: { defineAs: defineAs, idx: idx, length: defineHist.length, formula: topFormula } }))

          dispatch({
            type: Constants.DEFINE,
            text: defineAs,
            idx: idx,
            formula: topFormula
          })
        })
    }
  },

  /* @author: Akshal Aniche
   * define unparsable utterance to be the selected parsable utterance produced by extended parsing
   */
  defineUnparsable: (selectedIdx) => {
	  return (dispatch, getState) => {
	      const { sessionId } = getState().user
	      const { responses, unparsable } = getState().world

	      const defineHist = [responses[selectedIdx]].map(el => [el.utterance, el.formula])
	      
	      console.log(defineHist)
	      
      const sempreQuery = `(:def "${unparsable}" ${JSON.stringify(JSON.stringify(defineHist))})`
      		  console.log(sempreQuery)
      	  /* Submit the define command */
	      SEMPREquery({ q: sempreQuery, sessionId: sessionId })
	        .then((r) => {
	          if (r.lines && r.lines.length > 0) {
	            /* Display errors and quit if there errors */
	            alert(`There were error(s) in this definition: ${r.lines.join(", ")}`)
	            return
	          }
	
	          const { formula: topFormula } = r.candidates[0]
	          
	          dispatch(Logger.log({ type: "define", msg: { defineAs: unparsable, idx: 0, length: defineHist.length, formula: topFormula } }))
	
	          dispatch({
	            type: Constants.DEFINE,
	            text: unparsable,
	            idx: 0,
	            formula: topFormula
	          })
	        })
	        
	        //reset unparsable
	        dispatch({
	      		type: Constants.UNPARSABLE,
	      		unparsable: ""
	      	  })
	  }
  },
  
  revert: (idx) => {
    return (dispatch) => {
      dispatch(Logger.log({ type: "revert", msg: { idx: idx } }))

      dispatch({
        type: Constants.REVERT,
        idx: idx
      })
    }
  },

  resetResponses: () => {
    return (dispatch) => {
      dispatch({
        type: Constants.RESET_RESPONSES
      })
    }
  },

  closeDefine: () => {
    return (dispatch) => {
      dispatch(Logger.log({ type: "closeDefine" }))

      dispatch({
        type: Constants.CLOSE_DEFINE
      })
    }
  },

  openDefine: (idx) => {
    return (dispatch, getState) => {
      dispatch(Logger.log({ type: "openDefine", msg: { idx } }))

      dispatch({
        type: Constants.OPEN_DEFINE,
        defineN: idx
      })
    }
  },

  setDefineN: (idx) => {
    return (dispatch) => {
      dispatch({
        type: Constants.SET_DEFINE_N,
        defineN: idx
      })
    }
  },

  setPin: () => {
    return (dispatch) => {
      dispatch({
        type: Constants.SET_PIN
      })
    }
  },

  markPin: (idx) => {
    return (dispatch) => {
      dispatch({
        type: Constants.MARK_PIN,
        idx
      })
    }
  },

  injectPin: (idx) => {
    return (dispatch) => {
      dispatch({
        type: Constants.INJECT_PIN,
        idx
      })
    }
  },

  removePin: (idx) => {
    // Does getState work here?
    return (dispatch, getState) => {
      const { history } = getState().world
      dispatch({
        type: Constants.REMOVE_PIN,
        idx
      })
      if (idx === history.length - 1) {
        let query = history[history.length-1].text;
        dispatch({
          type: Constants.SET_QUERY,
          query
        })
      }
    }
  },

  removeLast: () => {
    return (dispatch) => {
      dispatch({
        type: Constants.REMOVE_LAST
      })
    }
  },

  clear: () => {
    return (dispatch, getState) => {
      dispatch({
        type: Constants.CLEAR
      })
      persistStore(getStore(), { whitelist: ['world', 'user'] }, () => { }).purge()
    }
  },
  
  dictionary: () => {
	  return (dispatch, getState) => {
	      const { sessionId } = getState().user
		  const sempreQuery= "(:dictionary)"
		  	  
		  console.log("Dictionary request")

		  SEMPREquery({ q: sempreQuery, sessionId: sessionId })
		    .then((r) => {
		        if (r.lines && r.lines.length > 0) {
		            /* Display errors and quit if there errors */
		            alert(`There were error(s): ${r.lines.join(", ")}`)
		            return
                }
		        const dictionary = JSON.parse(r.stats.dictionary)
                //console.log(dictionary)
                dispatch({
		        	type: Constants.DICTIONARY,
		        	dictionary: dictionary
				})
			})
	  }
  },
  
  deleteRule: (idx) => {
	  return (dispatch, getState) => {
		  const { sessionId } = getState().user
		  const sempreQuery= "(:delete " + idx + ")"
		  SEMPREquery({ q: sempreQuery, sessionId: sessionId })
		  	.then((r) => {
		        if (r.lines && r.lines.length > 0) {
		            /* Display errors and quit if there errors */
		            alert(`There were error(s): ${r.lines.join(", ")}`)
		            return
                }
		        //Force change to the dictionary to force rerendering
		        dispatch({
		        	type: Constants.DICTIONARY,
		        	dictionary: []
				})
		  	})
	  }
  },
}

export default Actions
