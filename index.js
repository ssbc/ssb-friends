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
    return pull(
      layered.hopStream(opts),
      FlatMap(function (change) {
        var a = []
        for(var k in change)
          a.push(opts && opts.meta ? {id: k, hops: change[k]} : k)
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
        if(g && opts.id !== id && g[opts.id] && g[opts.id][id] === false) {
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
    layered.onReady(function () {
      var g = layered.getGraph()
      if(g && g[sbot.id] && g[sbot.id][args[0]] === false)
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
    streamNotify({from:j, to:k, value:v})
  })

  return {
    post: null, //remove this till i figure out what used it.
    stream: function () {
      var source = streamNotify.listen()
      source.push(layered.getGraph())
      return source
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
            value = value[opts.dest]
        }
        else if( opts && opts.dest) {
          var _value = {}
          for(var k in value)
            if('undefined' !== typeof value[k][opts.dest])
              _value[k] = value[k][opts.dest]
          return cb(null, _value)
        }
        cb(null, value)
      })
    },

    createFriendStream: createFriendStream,
//    stream: index.stream,
    //legacy, debugging
    hops: function (opts, cb) {
      if(isFunction(opts))
        cb = opts, opts = {}
      cb(null, layered.getHops())
//      opts = opts || {}
//      if(isString(opts))
//        opts = {start: opts}
//      index.get(null, function (err, g) {
//        if(err) cb(err)
//        else cb(null, G.hops(g, opts.start || sbot.id, 0, opts.hops || 3))
//      })
    }
  }
}



