const FlatMap = require('pull-flatmap')
const pull = require('pull-stream')
const Notify = require('pull-notify')

function createLog (message) {
  let logged = false
  return function () {
    if (logged) return
    logged = true
    console.error(message)
  }
}

module.exports = function setupLegacy(layered) {
  function mapGraph (g, fn) {
    const _g = {}
    for (const j in g) {
      for (const k in g[j]) {
        _g[j] = _g[j] || {}
        _g[j][k] = fn(g[j][k])
      }
    }
    return _g
  }

  function map (o, fn) {
    const _o = {}
    for (const k in o) _o[k] = fn(o[k])
    return _o
  }

  function toLegacyValue (v) {
    // follow and same-as are shown as follow
    // -2 is unfollow, -1 is block.
    return v >= 0 ? true : v === -2 ? null : v === -1 ? false : null
  }

  const logLegacy1 = createLog('ssb-friends: createFriendStream legacy api used')
  const logLegacy2 = createLog('ssb-friends: get legacy api used')
  const logLegacy3 = createLog('ssb-friends: stream legacy api used')

  return {
    createFriendStream: function (opts) {
      logLegacy1()
      let first = true
      return pull(
        layered.hopStream(opts),
        FlatMap(function (change) {
          const a = []
          for (const k in change) {
            if (!first || change[k] >= 0) {
              if (opts && opts.meta) {
                a.push({ id: k, hops: change[k] })
              } else {
                a.push(k)
              }
            }
          }
          first = false
          return a
        })
      )
    },
    get: function (opts, cb) {
      logLegacy2()
      if (!cb) {
        cb = opts
        opts = {}
      }
      layered.onReady(function () {
        let value = layered.getGraph()
        // opts is used like this in ssb-ws
        if (opts && opts.source) {
          value = value[opts.source]
          if (value && opts.dest) {
            cb(null, toLegacyValue(value[opts.dest]))
          } else {
            cb(null, map(value, toLegacyValue))
          }
        } else if (opts && opts.dest) {
          const _value = {}
          for (const k in value) {
            if (typeof value[k][opts.dest] !== 'undefined') {
              _value[k] = value[k][opts.dest]
            }
          }
          cb(null, map(_value, toLegacyValue))
        } else { cb(null, mapGraph(value, toLegacyValue)) }
      })
    },
    stream: function () {
      logLegacy3()
      const streamNotify = Notify()
      const source = streamNotify.listen()
      layered.onReady(function () {
        streamNotify(mapGraph(layered.getGraph(), toLegacyValue))
        layered.onEdge(function (j, k, v) {
          streamNotify({ from: j, to: k, value: toLegacyValue(v) })
        })
      })
      return source
    }
  }
}
