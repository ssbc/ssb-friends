var FlatMap = require('pull-flatmap')
var pull    = require('pull-stream')
var Notify  = require('pull-notify')

function createLog(message) {
  var logged = false
  return function () {
    if(logged) return
    logged = true
    console.error(message)
  }
}

module.exports = function (layered) {

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

  var streamNotify = Notify()
  layered.onEdge(function (j,k,v) {
    streamNotify({from:j, to:k, value:toLegacyValue(v)})
  })

  var log_legacy1 = createLog('ssb-friends: createFriendStream legacy api used')
  var log_legacy2 = createLog('ssb-friends: get legacy api used')
  var log_legacy3 = createLog('ssb-friends: stream legacy api used')


  return {
    createFriendStream: function (opts) {
      log_legacy1()
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
    },
    get: function (opts, cb) {
      log_legacy2()
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
          cb(null, map(_value, toLegacyValue))
        }
        else
          cb(null, mapGraph(value, toLegacyValue))
      })
    },
    stream: function () {
      log_legacy3()
      var source = streamNotify.listen()
      source.push(mapGraph(layered.getGraph(), toLegacyValue))
      return source
    }
  }
}





