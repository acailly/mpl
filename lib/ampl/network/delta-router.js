'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peergroup = require('./peergroup');

var _peergroup2 = _interopRequireDefault(_peergroup);

var _tesseract = require('tesseract');

var _tesseract2 = _interopRequireDefault(_tesseract);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DeltaRouter = function () {
  function DeltaRouter(peergroup, getTesseractCB, applyTesseractDeltasCB) {
    var _this = this;

    _classCallCheck(this, DeltaRouter);

    this.peergroup = peergroup;
    this.getTesseractCB = getTesseractCB;
    this.applyTesseractDeltasCB = applyTesseractDeltasCB;

    this.clocks = {};

    //// --- how the network chatter works --- ///

    //// MESSAGE TYPES:

    //// Delta Message { deltas:[], vectorClock:vc }
    ////      when sending delta messages preemtively add the updated deltas to our stored clock for that peer
    ////      this prevents a cascade of repeated deltas if we send more than 1 delta before the first reply

    //// Vector Clock  { vectorClock:vc }
    ////      this lets peers know where you are and what to (or not to) send

    //// EVENTS AND WHAT TO DO:

    //// On Connect -->
    ////      send a Vector Clock to the peer (and they send one to you)
    //// On Local State Change -->
    ////      broadcast a deltas message to all peers
    //// On Vector Clock -->
    ////      if I have deltas they need --> Send Delta Message
    ////      if they have deltas I need --> Send a Vector Clock back (to trigger the deltas exchange)
    ////      otherwise do nothing and let the exchange end
    //// On Deltas Message -->
    ////      apply deltas - then send vector clock to all peers so they know my current state

    //// NOTE:

    ////      currently all messages have a docId which we filter on - multidoc is on its way

    this.peergroup.peers().forEach(function (peer) {
      if (peer.self == false) {
        _this.sendVectorClockToPeer(peer);
      }
    });

    this.peergroup.on('peer', function (peer) {

      // send our clock to peers when we first connect so they
      // can catch us up on anything we missed.
      peer.on('connect', function () {
        if (peer.self == false) {
          // FIXME - remove once we take self out of peers
          _this.sendVectorClockToPeer(peer);
        }
      });

      peer.on('message', function (m) {
        var state = _this.getTesseractCB

        // right now we only care about a single docId
        ();if (m.docId != state.docId) {
          return;
        }

        // try and apply deltas we receive
        if (m.deltas && m.deltas.length > 0) {
          console.log("APPLY DELTAS", m.deltas.length);
          _this.applyTesseractDeltasCB(m.deltas);
          _this.broadcastVectorClock();
        }

        // and if we get a vector clock, send the peer anything they're missing
        if (m.vectorClock) {
          // ignore acks for all but the last send
          console.log("got vector clock from", peer.id, m.vectorClock);
          _this.clocks[peer.id] = _this.clockMax(m.vectorClock, _this.clocks[peer.id] || {});

          if (_this.aheadOf(peer)) {
            console.log("We are ahead - send deltas", peer.id);
            _this.sendDeltasToPeer(peer);
          }

          if (_this.behind(peer)) {
            console.log("We are behind - request deltas", peer.id);
            _this.sendVectorClockToPeer(peer);
          }
        }
      });
    });
  }

  // after each new local operation broadcast it to any peers that don't have it yet


  _createClass(DeltaRouter, [{
    key: 'broadcastVectorClock',
    value: function broadcastVectorClock() {
      var _this2 = this;

      console.log("broadcast vector clock");
      this.peergroup.peers().forEach(function (peer) {
        _this2.sendVectorClockToPeer(peer);
      });
    }
  }, {
    key: 'broadcastState',
    value: function broadcastState() {
      var _this3 = this;

      console.log("broadcast state");
      this.peergroup.peers().forEach(function (peer) {
        _this3.sendDeltasToPeer(peer);
      });
    }
  }, {
    key: 'sendDeltasToPeer',
    value: function sendDeltasToPeer(peer) {
      console.log("maybe send deltas");
      var state = this.getTesseractCB();
      var myClock = _tesseract2.default.getVClock(state);
      var theirClock = this.clocks[peer.id];

      if (theirClock) {
        var deltas = _tesseract2.default.getDeltasAfter(state, theirClock);
        if (deltas.length > 0) {
          this.clocks[peer.id] = this.clockMax(myClock, theirClock);
          console.log("SEND DELTAS", deltas.length
          // we definitely shuoldn't be passing "boardTitle" like this
          );peer.send({ docId: state.docId, docTitle: state.boardTitle, vectorClock: myClock, deltas: deltas });
        }
      }
    }
  }, {
    key: 'sendVectorClockToPeer',
    value: function sendVectorClockToPeer(peer) {
      var state = this.getTesseractCB();
      var myClock = _tesseract2.default.getVClock(state);
      console.log("send vector clock to peer", myClock
      // we definitely shuoldn't be passing "boardTitle" like this
      );peer.send({ docId: state.docId, docTitle: state.boardTitle, vectorClock: myClock });
    }
  }, {
    key: 'behind',
    value: function behind(peer) {
      var clock = this.clocks[peer.id];
      var state = this.getTesseractCB();
      var myClock = _tesseract2.default.getVClock(state);
      for (var i in clock) {
        var a = clock[i];
        var b = myClock[i] || 0;
        if (a > b) return true;
      }
      return false;
    }
  }, {
    key: 'aheadOf',
    value: function aheadOf(peer) {
      var clock = this.clocks[peer.id];
      var state = this.getTesseractCB();
      var myClock = _tesseract2.default.getVClock(state);
      for (var i in myClock) {
        var a = myClock[i];
        var b = clock[i] || 0;
        if (a > b) return true;
      }
      return false;
    }

    /* This should probably be a feature of Tesseract */

  }, {
    key: 'clockMax',
    value: function clockMax(clock1, clock2) {
      var maxclock = {};
      var keys = Object.keys(clock1).concat(Object.keys(clock2));

      for (var i in keys) {
        var key = keys[i];
        maxclock[key] = Math.max(clock1[key] || 0, clock2[key] || 0);
      }

      return maxclock;
    }
  }]);

  return DeltaRouter;
}();

exports.default = DeltaRouter;