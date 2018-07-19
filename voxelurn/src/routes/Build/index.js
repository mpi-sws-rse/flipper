import React, { Component, PropTypes } from 'react'
import Actions from "actions/world"
import LoggerActions from "actions/logger"
import UserActions from "actions/user"
import { connect } from "react-redux"
import Mousetrap from "mousetrap"
import History from "containers/History"
import Setting, { equalityCheck } from "setting"
import CommandBar from "containers/CommandBar"
import ActionPopup from "components/ActionPopup"
import RoomTable from "components/RoomTable"
//import ControlButtons from "components/ControlButtons"
import { STATUS } from "constants/strings"
import { genTarget } from "helpers/util"
import StatusMsg from "components/StatusMsg"
import ResetPanel from "components/ResetPanel"
import DictionaryPanel from "components/Dictionary"

import "./styles.css"

class Build extends Component {
  static propTypes = {
    /* Injected by Redux */
    status: PropTypes.string,
    historyLen: PropTypes.number,
    responses: PropTypes.array,
    dispatch: PropTypes.func,
    task: PropTypes.string,
    //popup: PropTypes.object,

    roomMarkers: PropTypes.array,
    pointMarkers: PropTypes.array
  }

  constructor(props) {
    super(props)

    this.state = {
      selectedResp: 0,
      targetIdx: -1,
      target: [],
      possSteps: 33,
      win: false
    }
  }

  componentDidMount() {
    /* Bind Ctrl+Z and Crtl+Shift+Z to Undo and Redo actions respectively */
    Mousetrap.prototype.stopCallback = () => false;
    //Mousetrap.bind("command+z", (e) => { e.preventDefault(); this.props.dispatch(Actions.undo()) })
    //Mousetrap.bind("command+shift+z", (e) => { e.preventDefault(); this.props.dispatch(Actions.redo()) })

    /* If there is a ?taskid=N as a URL parameter, set the task as 'target',
     * otherwise, set a current structure id for the currently working sturct */
    if (Object.keys(this.props.location.query).indexOf("taskid") !== -1) {
      this.props.dispatch(UserActions.setTask("target"))
      this.setTarget()
    } else {
      this.props.dispatch(LoggerActions.setStructureId())
    }
  }

  // componentWillReceiveProps(nextProps) {
  //   if (this.props.world.status === "accept" && nextProps.world.status === "define") {
  //     this.handleQuery(this.props.world.query)
  //   }
  // }

  componentDidUpdate(prevProps) {
    /* Whenever there is a status change, reset the selected response */
    if (prevProps.status !== this.props.status)
      this.setState({ selectedResp: 0 })

    /* Check for win! */
    if (this.props.task === "target" && this.props.history.length > 0 && equalityCheck(this.props.history[this.props.history.length - 1].value, this.state.target)) {
      /* WIN! */
      this.win()
    } else if (this.state.win) {
      this.setState({ win: false })
    }

    /* Check to see if we need to set the target */
    if (prevProps.task === "world" && this.props.task === "target")
      this.setTarget()
  }

  componentWillUnmount() {
    /* Clean up the key undo+redo bindings */
    Mousetrap.unbind("command+z")
    Mousetrap.unbind("command+shift+z")
  }

  setTarget() {
    const randomTarget = genTarget()
    this.setState({ target: randomTarget[2], possSteps: randomTarget[1], targetIdx: randomTarget[0] })

    this.props.dispatch(LoggerActions.log({ type: "start", msg: { targetIdx: randomTarget[0], target: randomTarget[2] } }))
  }

  handleQuery(query) {
    switch (this.props.status) {
      case STATUS.TRY:
        /* Try the query */
        this.props.dispatch(Actions.tryQuery(query))
          .then(r => {
            if (r === null) { // If an error occurred
              this.props.dispatch(Actions.setStatus(STATUS.TRY));
            } else if (!r) {
              /* The try query was unsuccessful, so set it as a pin */
              this.props.dispatch(Actions.setPin())
              this.props.dispatch(Actions.resetResponses())
              this.props.dispatch(Actions.setQuery(""))
              this.setState({ selectedResp: 0 })
            } else {
              /* Try query successful! Give the user a choice */
              this.setState({ selectedResp: 0 })
            }
          })
        break;
      case STATUS.ACCEPT:
        /* Max steps check */
        if (this.props.task === "target" && this.props.historyLen >= this.maxSteps()) {
          alert("You've reached the maximum number of steps of " + this.maxSteps() + " , undo some steps in order to add more.")
          this.setState({ selectedResp: 0 })
          return
        }
        
      //if unparsable, define
        if (this.props.unparsable !== "") {
        	console.log("Defining unparsable")
        	this.props.dispatch(Actions.defineUnparsable(this.state.selectedResp))	
        }

        /* Otherwise, just accept normally */
        //const r = this.props.dispatch(Actions.accept(query, this.state.selectedResp))
        const r = this.props.dispatch(Actions.acceptPath(query, this.state.selectedResp))
        
        if (r)
          this.setState({ selectedResp: 0 })

        break
      case STATUS.DEFINE:
        this.props.dispatch(Actions.define(this.props.defineN))
        break
      case STATUS.LOADING:
        this.props.dispatch(Actions.setStatus(STATUS.TRY))
        break
      default:
        console.log("uh oh... unknown status!", this.props.status)
        break
    }
  }

  maxSteps() {
    /* If this is a qualifier with a targer, there is a max steps */
    if (this.props.task !== "target")
      return Infinity

    return this.state.possSteps * 3
  }

  win() {
    if (!this.state.win) {
      this.props.dispatch(LoggerActions.log({ type: "win", msg: { steps: this.props.history.length } }))
      this.setState({ win: true })
    }
  }

  upSelected() {
    const selectedResp = this.state.selectedResp
    if (selectedResp < this.props.responses.length - 1) {
      this.setState({ selectedResp: selectedResp + 1 })
      this.props.dispatch(LoggerActions.log({ type: "scroll", msg: { dir: "up" } }))
    }
  }

  downSelected() {
    const selectedResp = this.state.selectedResp
    if (selectedResp > 0) {
      this.setState({ selectedResp: selectedResp - 1 })
      this.props.dispatch(LoggerActions.log({ type: "scroll", msg: { dir: "down" } }))
    }
  }

  closeDefine() {
    this.props.dispatch(Actions.closeDefine())
  }

  handleShiftClick() {
    // TODO: open up the latest define
    // const { history, defining } = this.props.world
    // if (defining) return
    // /* Find last pin to define */
    // const idx = history.slice().reverse().findIndex(h => h.type === "pin")
    // if (idx !== -1) {
    //   this.props.dispatch(Actions.define(history.length - 1 - idx))
    // } else {
    //   alert("shift-enter is for defining, you are not in defining mode")
    // }
  }

  render() {
    const { status, responses, pointMarkers, roomMarkers, history,
        current_history_idx, task } = this.props

    /* The current state should be the history element at the last position, or
     * the one selected by the current_history_idx */
    let idx = current_history_idx >= 0 ? current_history_idx : history.length - 1
    if (idx > history.length - 1) idx = history.length - 1
    let currentState = history[idx].worldMap;
    // TODO This might be unnecessary
    let robot = history[idx].robot;
    let currentPath = [];// = history[idx].path;

    let popup = { text: "", active: false };
    if (status === STATUS.ACCEPT && !responses[this.state.selectedResp].error) {
      /* If the status is accept, then the current state will be the diff
       * of the previous state and the responded state */
      //currentState = diff(currentState, responses[this.state.selectedResp].value)
      let response = JSON.parse(JSON.stringify(responses[this.state.selectedResp])); 
      currentPath = response.path;
      //currentPath = JSON.parse(JSON.stringify(responses[this.state.selectedResp].path));
      if (response.status.length === 0) {
        popup.active = false;
      } else {
        popup.text = response.status;
        popup.active = true;
      }
    }

    return (
      <div className="Build">
        <div className="Build-info" >
          <RoomTable
          />
        </div>
        <div className="Build-world">
          <Setting
            blocks={currentState}
            path={currentPath}
            robot={robot}
            pointMarkers={pointMarkers}
            roomMarkers={roomMarkers}
            width={1650}
            height={1200}
            isoConfig={{ canvasWidth: 1650, canvasHeight: 1200, numUnits: 40 }} />
        </div>
        <div className="Build-command">
          <History />
          <ActionPopup
            active={popup.active}
            text={popup.text} />
          <CommandBar
            onClick={(query) => this.handleQuery(query)}
            handleShiftClick={() => this.handleShiftClick()}
            onUp={() => this.upSelected()}
            onDown={() => this.downSelected()} />
          <div className="Build-status">
            <StatusMsg status={status} />
            <div className="Build-actions">
              {status === STATUS.ACCEPT &&
                <div>
                  <span>{this.state.selectedResp + 1} / {responses.length} possible interpretations</span>
                  <div className="Build-actions-buttons">
                    <button onClick={() => this.downSelected()}>&uarr;</button>
                    <button onClick={() => this.upSelected()}>&darr;</button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
       <DictionaryPanel />
       <ResetPanel />
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  status: state.world.status,
  historyLen: state.world.history.length,
  history: state.world.history,
  task: state.user.task,
  responses: state.world.responses,
  roomMarkers: state.world.roomMarkers,
  pointMarkers: state.world.pointMarkers,
  defineN: state.world.defineN,
  //popup: state.world.popup,
  current_history_idx: state.world.current_history_idx,
  unparsable: state.world.unparsable,
})

export default connect(mapStateToProps)(Build)
