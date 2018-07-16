import Constants from "constants/actions"
import { STATUS } from "constants/strings"
import { worldConfig } from "constants/defaultMap"

const initialState = {
  history: [{
    text: "initial",
    worldMap: worldConfig.worldMap,
    robot: worldConfig.robot,
    path: [],
    formula: "(initial)" }],
  responses: [],
  pointMarkers: [], 
  roomMarkers: [], 
  //robotStep: 0, // How far is the robot along its visual simulation
  current_history_idx: -1,
  status: STATUS.TRY,
  query: "",
  //popup: { active: true, text: "No error yet!" },
  defining: false,
  //exampleQuery: "add red 3 times",
  defineN: null,
  dictionary: [],
  unparsable: "",
}

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case Constants.SET_QUERY:
      return { ...state, query: action.query }
    case Constants.REVERT:
      if (state.defining) {
        return state
      }
      return { ...state, current_history_idx: action.idx, responses: initialState.responses, status: initialState.status, query: initialState.query }

    case Constants.TRY_QUERY:
      let history = state.history
      if (state.current_history_idx >= 0) {
        history = history.slice(0, state.current_history_idx + 1)
      }
      return { ...state, responses: action.responses, history: history, current_history_idx: -1, status: STATUS.ACCEPT }
    case Constants.ACCEPT:
      const newHistory = [...state.history, action.el]
      return { ...state, history: newHistory, responses: [], status: STATUS.TRY, query: "", unparsable: "" }
    case Constants.DEFINE:
      // TODO The "value" here will have to be changed
      let collapsedHistory = [...state.history.slice(0, action.idx), {
        text: action.text,
        //value: state.history[state.history.length - 1].value,
        worldMap: state.history[state.history.length - 1].worldMap,
        robot: state.history[state.history.length - 1].robot,
        path: [],
        formula: action.formula
      }]
      if (collapsedHistory.length === 0) collapsedHistory = initialState.history
      else if (collapsedHistory.length === 1) collapsedHistory = [...initialState.history, ...collapsedHistory]
      return { ...state, history: collapsedHistory, defining: false, defineN: null, query: "", status: STATUS.TRY, dictionary: [] }
    case Constants.SET_STATUS:
      return { ...state, status: action.status }
    ///////
    case Constants.UPDATE_POINT_MARKERS:
      return { ...state, pointMarkers: action.pointMarkers }
    case Constants.UPDATE_ROOM_MARKERS:
      return { ...state, roomMarkers: action.roomMarkers }
    ///////
    case Constants.RESET_RESPONSES:
      return { ...state, status: STATUS.TRY, query: "", responses: [] }
    case Constants.OPEN_DEFINE:
      return { ...state, defining: true, defineN: action.defineN }
    case Constants.CLOSE_DEFINE:
      const cleanHistory = state.history.filter(h => h.formula !== "false") /* we have to clean up any inejcted pins */
      return { ...state, defining: false, defineN: null, query: "", status: STATUS.TRY, history: cleanHistory }
    case Constants.SET_DEFINE_N:
      return { ...state, defineN: action.defineN }
    case Constants.SET_PIN:
      // I am not sure what "value" was doing; it might have been replaced with "robot" and "worldMap"
      let newHistoryWithPin = [...state.history, {
        text: state.query,
        type: "pin",
        worldMap: state.history[state.history.length - 1].worldMap,
        robot: state.history[state.history.length - 1].robot,
        path: [],
        formula: "()"
      }]
      return { ...state, history: newHistoryWithPin, query: initialState.query, responses: initialState.responses, status: initialState.status, defining: initialState.defining, defineN: initialState.defineN }
    case Constants.REMOVE_PIN:
      let newHistoryWithoutPin = state.history.slice()
      newHistoryWithoutPin.splice(action.idx, 1)
      return { ...state, history: newHistoryWithoutPin, current_history_idx: initialState.current_history_idx }
    case Constants.MARK_PIN:
      const markedHistory = state.history.slice()
      const index = action.idx ? action.idx : markedHistory.length - 1
      markedHistory[index] = { ...markedHistory[index], type: "pin" }
      return { ...state, history: markedHistory }
    case Constants.INJECT_PIN:
      let injectedHistory = state.history.slice(0)
      // TODO Change "value"
      injectedHistory.splice(action.idx, 0, {
        text: "",
        type: "pin",
        //value: [], // Not sure what worldMap should be
        worldMap: state.history[state.history.length - 1].worldMap,
        robot: state.history[state.history.length - 1].robot,
        path: [],
        formula: "false"
      })
      return { ...state, history: injectedHistory }
    case Constants.REMOVE_LAST:
      let trimmedHistory = state.history.slice(0, state.history.length - 1)
      return { ...state, history: trimmedHistory, query: initialState.query, status: initialState.status, responses: initialState.responses }
    case Constants.CLEAR:
      return { ...initialState, dictionary: state.dictionary}
    case Constants.DICTIONARY:
      return { ...state, dictionary: action.dictionary}
    case Constants.UNPARSABLE:
    	return {...state, unparsable: action.unparsable}
    case Constants.PARSABLE:
    	return {...state, unparsable: initialState.unparsable}
    default:
      return state
  }
}
