'use strict'
//var G           = require('graphreduce')
//var Reduce      = require('flumeview-reduce')
var pull        = require('pull-stream')
var ref         = require('ssb-ref')
var Obv         = require('obv')
var pCont       = require('pull-cont/source')
var Notify      = require('pull-notify')

var LayeredGraph = require('layered-graph')

// friends plugin
// methods to analyze the social graph
// maintains a 'follow' and 'flag' graph

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

function isFriend (friends, a, b) {
  return friends[a] && friends[b] && friends[a][b] && friends[b][a]
}

function isEmpty (o) {
  for(var k in o)
    return false
  return true
}

exports.name = 'friends'
exports.version = '1.0.0'
exports.manifest = {
  get: 'async',
  createFriendStream: 'source',
  stream: 'source',
  hops: 'async',
}

//mdm.manifest(apidoc)

exports.init = function (sbot, config) {
  
  var max = config.friends && config.friends.hops || config.replicate && config.replicate.hops || 3
  var layered = LayeredGraph({max: max, start: sbot.id})

  function isFollowing (opts, cb) {
    layered.onReady(function () {
      var g = layered.getGraph()
        cb(null, g[opts.source] && g[opts.source][opts.dest] >= 0)
    })
  }

  function isBlocking (opts, cb) {
    layered.onReady(function () {
      var g = layered.getGraph()
        cb(null, Math.round(g[opts.source] && g[opts.source][opts.dest]) == -1)
    })
  }

  //BLOCKING

  //should things like createHistoryStream instead
  //call a block prehook?
  sbot.createHistoryStream.hook(function (fn, args) {
    var opts = args[0], id = this.id
    //reminder: this.id is the remote caller.
    var self = this
    return pCont(function (cb) {
      //wait till the index has loaded.
      layered.onReady(function () {
        var g = layered.getGraph()
        if(g && opts.id !== id && g[opts.id] && g[opts.id][id] === -1) {
          cb(null, function (abort, cb) {
            //just give them the cold shoulder
          })
        } else
          cb(null, pull(
            fn.apply(self, args),
            //break off this feed if they suddenly block
            //the recipient.
            pull.take(function (msg) {
              //handle when createHistoryStream is called with keys: true
              if(!msg.content && msg.value.content)
                msg = msg.value
              if(msg.content.type !== 'contact') return true
              return !(
                (msg.content.flagged || msg.content.blocking) &&
                msg.content.contact === id
              )
            })
          ))
      })
    })
  })

  sbot.auth.hook(function (fn, args) {
    var self = this
    isBlocking({source: sbot.id, dest: args[0]}, function (err, blocked) {
      if(blocked)
        args[1](new Error('client is blocked'))
      else fn.apply(self, args)
    })
  })

  // ^^ BLOCKING

  // REPLICATION
  if(!sbot.replicate)
    throw new Error('ssb-friends expects a replicate plugin to be available')

  pull(
    layered.hopStream({live: true, old: true}),
    pull.drain(function (data) {
      if(data.sync) return
      for(var k in data) {
        sbot.replicate.request(k, data[k] >= 0)
      }
    })
  )

  require('./contacts')(sbot, layered.createLayer, config)

  var legacy = require('./legacy')(layered)

  return {

    hopStream: layered.hopStream,
    onEdge: layered.onEdge,

    get: legacy.get,
    createFriendStream: legacy.createFriendStream,
    stream: legacy.stream,

    isFollowing: isFollowing,

    isBlocking: isBlocking,

    //legacy, debugging
    hops: function (opts, cb) {
      layered.onReady(function () {
        if(isFunction(opts))
          cb = opts, opts = {}
        cb(null, layered.getHops())
      })
    },

    //expose createLayer, so that other plugins may express relationships
    createLayer: layered.createLayer
  }
}





