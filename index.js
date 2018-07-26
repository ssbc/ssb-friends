'use strict'
//var G           = require('graphreduce')
//var Reduce      = require('flumeview-reduce')
var FlatMap     = require('pull-flatmap')
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
  hops: 'async'
}

//mdm.manifest(apidoc)

exports.init = function (sbot, config) {

  var max = config.friends && config.friends.hops || config.replicate && config.replicate.hops || 3
  var layered = LayeredGraph({max: max, start: sbot.id})

  function createFriendStream (opts) {
    var first = true
    return pull(
      layered.hopStream(opts),
      FlatMap(function (change) {
        var a = []
        for(var k in change)
          if(!first || change[k] >= 0)
            a.push(opts && opts.meta ? {id: k, hops: change[k]} : k)
        first = false
        return a
      })
    )
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

  var streamNotify = Notify()
  layered.onEdge(function (j,k,v) {
    streamNotify({from:j, to:k, value:toLegacyValue(v)})
  })

  function mapGraph (g, fn) {
    var _g = {}
    for(var j in g)
      for(var k in g[j]) {
        _g[j] = _g[j] || {}
        _g[j][k] = fn(g[j][k])
      }
    return _g
  }

  function map(o, fn) {
    var _o = {}
    for(var k in o) _o[k] = fn(o[k])
    return _o
  }

  function toLegacyValue (v) {
    //follow and same-as are shown as follow
    //-2 is unfollow, -1 is block.
    return v >= 0 ? true : v === -2 ? null : v === -1 ? false : null
  }

  return {
    post: null, //remove this till i figure out what used it.
    stream: function () {
      var source = streamNotify.listen()
      source.push(mapGraph(layered.getGraph(), toLegacyValue))
      return source
//      return pull(source, pull.map(function (e) {
//        return {from: e.from, to:e.to, value: toLegacyValue(e.value) }
//      }))
    },

    get: function (opts, cb) {
      if(!cb)
        cb = opts, opts = {}
      layered.onReady(function () {
        var value = layered.getGraph()
        //opts is used like this in ssb-ws
        if(opts && opts.source) {
          value = value[opts.source]
          if(value && opts.dest)
            cb(null, toLegacyValue(value[opts.dest]))
          else
            cb(null, map(value, toLegacyValue))
        }
        else if( opts && opts.dest) {
          var _value = {}
          for(var k in value)
            if('undefined' !== typeof value[k][opts.dest])
              _value[k] = value[k][opts.dest]
          cb(null, mapGraph(_value, toLegacyValue))
        }
        else
          cb(null, mapGraph(value, toLegacyValue))
      })
    },

    isFollowing: isFollowing,

    isBlocking: isBlocking,

    createFriendStream: createFriendStream,
    //legacy, debugging
    hops: function (opts, cb) {
      if(isFunction(opts))
        cb = opts, opts = {}
      cb(null, layered.getHops())
    }
  }
}




