import Tesseract from 'tesseract'
import fs from 'fs'
import uuid from './uuid'
import aMPLNet from './amplnet'
import EventEmitter from 'events'

export default class Store extends EventEmitter {
  constructor(reducer) {
    super()
    
    this.reducer   = reducer
    this.state     = this.tesseractInit()
    this.listeners = []

    let network = new aMPLNet()
    network.connect({
      peerId: this.state._state.get("_id"),
      docId: this.state.docId,
      store: this
    })

    this.network = network
  }

  dispatch(action) {
    let state = this.state
    let newState

    switch(action.type) {
      case "NEW_DOCUMENT":
        newState = this.newDocument(state, action)
        break;
      case "OPEN_DOCUMENT":
        newState = this.openDocument(state, action)
        break;
      case "MERGE_DOCUMENT":
        newState = this.mergeDocument(state, action)
        break;
      case "APPLY_DELTAS":
        newState = this.applyDeltas(state, action)
        break;
      default:
        newState = this.reducer(state, action)
    }

    this.state = newState

    if(action.type === "NEW_DOCUMENT" || action.type === "OPEN_DOCUMENT") {
      if(this.network) this.network.disconnect()

      let network = new aMPLNet()
      network.connect({
        peerId: this.state._state.get("_id"),
        docId: this.state.docId,
        store: this
      })

      this.network = network
    }

//    this.network.broadcast(newState, action.type)
    this.emit('change', action.type, newState)

    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener) {
    this.listeners.push(listener)
  }

  getState() {
    return this.state
  }

  save() {
    return Tesseract.save(this.getState())
  }

  openDocument(state, action) {
    let tesseract

    if(action.file)
      tesseract = Tesseract.load(action.file)
    else if(action.docId) {
      tesseract = Tesseract.init()
      tesseract = Tesseract.set(tesseract, "docId", action.docId)
    }

    return tesseract
  }

  mergeDocument(state, action) {
    let otherTesseract = Tesseract.load(action.file)
    return Tesseract.merge(state, otherTesseract)
  }

  applyDeltas(state, action) {
    return Tesseract.applyDeltas(state, action.deltas)
  }

  newDocument(state, action) {
    return this.tesseractInit()
  }

  removeAllListeners() {
    this.listeners = []
  }

  tesseractInit() {
    let tesseract = new Tesseract.init()
    tesseract = Tesseract.set(tesseract, "docId", uuid())

    return tesseract
  }
}
