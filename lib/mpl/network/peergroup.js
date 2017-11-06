'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _peer = require('./peer');

var _peer2 = _interopRequireDefault(_peer);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _automerge = require('automerge');

var _automerge2 = _interopRequireDefault(_automerge);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var IPFS = require('ipfs');
var Room = require('ipfs-pubsub-room');

var PeerGroup = function (_EventEmitter) {
  _inherits(PeerGroup, _EventEmitter);

  function PeerGroup(docSet, wrtc) {
    _classCallCheck(this, PeerGroup);

    var _this = _possibleConstructorReturn(this, (PeerGroup.__proto__ || Object.getPrototypeOf(PeerGroup)).call(this));

    var ipfs = new IPFS({
      repo: 'ipfs/pubsub-demo/' + Math.random(),
      EXPERIMENTAL: {
        pubsub: true
      },
      config: {
        "Addresses": {
          "API": "",
          "Gateway": "",
          "Swarm": ["/ip4/0.0.0.0/tcp/0"] } }
    });

    _this.ipfs = ipfs;

    _this.docSet = docSet;
    _this.wrtc = wrtc;

    _this.Peers = {};
    _this.connections = {};
    return _this;
  }

  _createClass(PeerGroup, [{
    key: 'join',
    value: function join(session, name) {
      var _this2 = this;

      // add ourselves to the peers list with a do-nothing signaller
      // this has to happen after all the listeners register... which suggests
      // we have some kind of an antipattern going

      this.ipfs.once('ready', function () {
        return _this2.ipfs.id(function (err, info) {
          if (err) {
            throw err;
          }
          console.log('IPFS node ready with address ' + info.id);

          _this2.room = Room(_this2.ipfs, 'ampl-experiment');

          _this2.room.on('peer joined', function (peer) {
            console.log('peer ' + peer + ' joined');
            if (peer == info.id) {
              return;
            }
            _this2.getOrCreatePeer(peer, peer, undefined);
          });
          _this2.room.on('peer left', function (peer) {
            console.log('peer ' + peer + ' left');
            delete _this2.Peers[peer];
            // this is wrong
          });

          // send and receive messages    
          _this2.room.on('message', function (message) {
            console.log('Automerge.Connection> receive ' + message.from + ': ' + message.data.toString());
            _this2.connections[message.from].receiveMsg(JSON.parse(msg.data.toString()));
          });
        });
      });

      /*    this.ipfs.id().then( (ipfsid) => {
            this.me = this.getOrCreatePeer(ipfsid, ipfsid, undefined)      
          })*/
    }
  }, {
    key: 'close',
    value: function close() {
      for (var id in this.Peers) {
        delete this.Peers[id];
      }
      ipfs.stop();
    }
  }, {
    key: 'peers',
    value: function peers() {
      return Object.values(this.Peers);
    }
  }, {
    key: 'self',
    value: function self() {
      return this.me;
    }
  }, {
    key: 'getOrCreatePeer',
    value: function getOrCreatePeer(id, name, handler) {
      var _this3 = this;

      if (!this.Peers[id]) {
        this.Peers[id] = name;
        this.connections[id] = new _automerge2.default.Connection(this.docSet, function (msg) {
          console.log('Automerge.Connection> send to ' + id + ':', msg);
          _this3.room.sendTo(id, JSON.stringify(msg));
        });

        /*peer.on('closed', () => {
          this.connections[id].close()
          delete this.connections[id]
          delete this.Peers[id]
        })*/

        this.connections[id].open();
        this.emit("peer", id);
      }

      return this.Peers[id];
    }
  }]);

  return PeerGroup;
}(_events2.default);

exports.default = PeerGroup;