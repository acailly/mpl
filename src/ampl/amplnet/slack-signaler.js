var RtmClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var bot_token = process.env.SLACK_BOT_TOKEN || '';

let rtm;// = new RtmClient(bot_token);

var UUID = (function() {
  var self = {};
  var lut = []; for (var i=0; i<256; i++) { lut[i] = (i<16?'0':'')+(i).toString(16); }
  self.generate = function() {
    var d0 = Math.random()*0xffffffff|0;
    var d1 = Math.random()*0xffffffff|0;
    var d2 = Math.random()*0xffffffff|0;
    var d3 = Math.random()*0xffffffff|0;
    return lut[d0&0xff]+lut[d0>>8&0xff]+lut[d0>>16&0xff]+lut[d0>>24&0xff]+'-'+
      lut[d1&0xff]+lut[d1>>8&0xff]+'-'+lut[d1>>16&0x0f|0x40]+lut[d1>>24&0xff]+'-'+
      lut[d2&0x3f|0x80]+lut[d2>>8&0xff]+'-'+lut[d2>>16&0xff]+lut[d2>>24&0xff]+
      lut[d3&0xff]+lut[d3>>8&0xff]+lut[d3>>16&0xff]+lut[d3>>24&0xff];
  }
  return self;
})();

function init(config) {
  let HANDLERS = { hello: () => {}, reply: () => {}, offer: () => {}, error: () => {}, connect: () => {}, disconnect: () => {} }
  let CHANNEL;
  let SESSION = config.session || UUID.generate()
  let NAME = config.name || "unknown"
  let DOC_ID;
  let last_ts
  let onConnectHandler = () => {}
  let CONNECT_DISPATCH = (h) => {
    onConnectHandler = h
  }
  let opts = { retryConfig: { forever: true, maxTimeout: 30 * 1000 }};

  rtm = new RtmClient(config.bot_token,opts);
  DOC_ID = config.doc_id

  // The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
  rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
    onConnectHandler()
    HANDLERS['connect']()
    for (const c of rtmStartData.channels) {
      if (c.is_member && c.name ==='signals') { CHANNEL = c.id }
    }
    console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}`);
  });

  // you need to wait for the client to fully connect before you can send messages
  rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    let msg = JSON.stringify({ action: "hello", name:NAME, session:SESSION, doc_id:DOC_ID })
    rtm.sendMessage(msg, CHANNEL);
  });

  rtm.on(CLIENT_EVENTS.RTM.WS_ERROR, function() {
    console.log("slack-signal: ws error")
  })

  rtm.on(CLIENT_EVENTS.RTM.WS_CLOSED, function() {
    console.log("slack-signal: ws closed")
  })

  rtm.on(CLIENT_EVENTS.RTM.WS_OPENED, function() {
    console.log("slack-signal: ws opened")
  })

  rtm.on(CLIENT_EVENTS.RTM.ATTEMPTING_RECONNECT, function() {
    console.log("slack-signal: attempting reconnect")
    HANDLERS['disconnect']()
  })

  //rtm.on(CLIENT_EVENTS.RTM.MESSAGE, function handleRtmMessage(message) {
  rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    let ts = parseFloat(message.ts)
    if (last_ts && last_ts > ts) console.log("WARNING - TS OUT OF ORDER")
    try {
      let msg = JSON.parse(message.text)
      if (msg.session != SESSION) {
        if (msg.doc_id == DOC_ID) {
          if (msg.action == "hello") { // "hello" doesn't have a msg.body, so pass undefined
            HANDLERS['hello'](msg, undefined, (reply) => {
                let msgJSON = JSON.stringify({ action: "offer", name: NAME, session:SESSION, doc_id:DOC_ID, to:msg.session, body:reply})
                rtm.sendMessage(msgJSON, CHANNEL);
            })
          }
          if (msg.action == "offer" && msg.to == SESSION) {
            HANDLERS['offer'](msg, msg.body, (reply) => {
                let msgJSON = JSON.stringify({ action: "reply", name: NAME, session:SESSION, doc_id:DOC_ID, to:msg.session, body:reply})
                rtm.sendMessage(msgJSON, CHANNEL);
            })
          }
          if (msg.action == "reply" && msg.to == SESSION) {
            HANDLERS['reply'](msg, msg.body)
          }
        }
      } else {
        console.log("Message was by me...")
      }
    } catch(e) {
      console.log("Was a non-json message - ignore")
      HANDLERS['error'](message,e)
    }
    last_ts = ts
  });
  return { 
    session: SESSION,
    name: NAME,
    on: (type,handler) => { HANDLERS[type] = handler },
    start: () => { rtm.start() },
    stop: () => {
      rtm.disconnect()
      HANDLERS['disconnect']()
    }
  }
}

module.exports = {
  init
}
