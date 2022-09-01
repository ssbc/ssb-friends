const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const pCont = require('pull-cont')
const LayeredGraph = require('layered-graph')
const isFeed = require('ssb-ref').isFeed
const contacts = require('./contacts')
const db2Contacts = require('./db2-contacts')
const help = require('./help')
const authGlue = require('./auth-glue')

exports.name = 'friends'
exports.version = '1.0.0'
exports.manifest = {
  follow: 'async',
  isFollowing: 'async',
  block: 'async',
  isBlocking: 'async',
  hops: 'async',
  hopStream: 'source',
  graph: 'async',
  graphStream: 'source',
  help: 'sync'
}

exports.init = function (sbot, config) {
  if (!config.friends) config.friends = {}
  const max = config.friends.hops || 3
  const layered = LayeredGraph({ max, start: sbot.id })

  if (sbot.db) {
    sbot.db.registerIndex(db2Contacts(layered.createLayer, layered.reset))
  } else {
    contacts(sbot, layered.createLayer)
  }

  function onReady (cb) {
    layered.onReady(() => {
      if (sbot.db) {
        sbot.db.onDrain('contacts', cb)
      } else {
        cb()
      }
    })
  }

  function isFollowing (opts, cb) {
    const { source, dest, details } = opts
    onReady(() => {
      const g = layered.getGraph()
      const response = g[source] ? g[source][dest] >= 0 : false
      if (details) {
        const g2 = layered.getGraph('contactsPrivate')
        const privately = g2[source] ? g2[source][dest] >= 0 : false
        cb(null, { response, private: privately })
      } else {
        cb(null, response)
      }
    })
  }

  function isBlocking (opts, cb) {
    const { source, dest, details } = opts
    onReady(() => {
      const g = layered.getGraph()
      const response = Math.round(g[source] && g[source][dest]) === -1
      if (details) {
        const g2 = layered.getGraph('contactsPrivate')
        const privately = Math.round(g2[source] && g2[source][dest]) === -1
        cb(null, { response, private: privately })
      } else {
        cb(null, response)
      }
    })
  }

  function follow (feedId, opts, cb) {
    if (!isFeed(feedId)) {
      return cb(new Error(`follow() requires a feedId, got ${feedId}`))
    }
    opts = opts || {}

    const content = {
      type: 'contact',
      contact: feedId,
      following: 'state' in opts ? opts.state : true,
      recps: opts.recps
    }
    sbot.publish(content, cb)
  }

  function block (feedId, opts, cb) {
    if (!isFeed(feedId)) {
      return cb(new Error(`block() requires a feedId, got ${feedId}`))
    }
    opts = opts || {}

    const content = {
      type: 'contact',
      contact: feedId,
      blocking: 'state' in opts ? opts.state : true,
      reason: typeof opts.reason === 'string' ? opts.reason : undefined,
      recps: opts.recps
    }
    sbot.publish(content, cb)
  }

  function graph (cb) {
    onReady(() => {
      cb(null, layered.getGraph())
    })
  }

  function graphStream (opts) {
    const {
      live = true,
      old = false
    } = opts || {}
    if (live) {
      return pCont((cb) => {
        onReady(() => {
          const unsubscribe = layered.onEdge((source, dest, value) => {
            p.push({ [source]: { [dest]: value } })
          })
          const p = Pushable(unsubscribe)
          if (old) {
            p.push(layered.getGraph())
          }
          cb(null, p)
        })
      })
    } else {
      return pCont((cb) => {
        onReady(() => {
          cb(null, pull.once(layered.getGraph()))
        })
      })
    }
  }

  function hops (opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    onReady(() => {
      cb(null, layered.getHops(opts))
    })
  }

  function hopStream (opts) {
    const {
      live = true,
      old = false
    } = opts || {}
    return layered.hopStream({ live, old, ...opts })
  }

  // Make sure blocked peers cannot connect, default is true
  if (config.friends.hookAuth !== false) {
    authGlue(sbot, layered, isBlocking)
  }

  return {
    follow,
    block,
    isFollowing,
    isBlocking,
    hops,
    hopStream,
    graph,
    graphStream,
    help: () => help
  }
}
