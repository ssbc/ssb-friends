const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const pCont = require('pull-cont')
const LayeredGraph = require('layered-graph')
const isFeed = require('ssb-ref').isFeed
const contacts = require('./contacts')
const db2Contacts = require('./db2-contacts')
const setupLegacy = require('./legacy')
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
  help: 'sync',

  // legacy:
  onEdge: 'sync',
  // createLayer: 'sync',       // not exposed over RPC as returns a function
  get: 'async',
  createFriendStream: 'source',
  stream: 'source'
}

exports.init = function (sbot, config) {
  if (!config.friends) config.friends = {}
  const max = config.friends.hops || 3
  const layered = LayeredGraph({ max: max, start: sbot.id })

  if (sbot.db) {
    sbot.db.registerIndex(db2Contacts(layered.createLayer))
  } else {
    contacts(sbot, layered.createLayer, config)
  }

  const legacy = setupLegacy(layered)

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
    onReady(() => {
      const g = layered.getGraph()
      cb(null, g[opts.source] ? g[opts.source][opts.dest] >= 0 : false)
    })
  }

  function isBlocking (opts, cb) {
    onReady(() => {
      const g = layered.getGraph()
      cb(null, Math.round(g[opts.source] && g[opts.source][opts.dest]) === -1)
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
    opts = opts || {}
    const old = opts.old === true // default is false
    const live = opts.live !== false // default is true
    if (live) {
      return pCont((cb) => {
        onReady(() => {
          let p
          const unsubscribe = layered.onEdge((source, dest, value) => {
            p.push({source, dest, value})
          })
          p = Pushable(unsubscribe)
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

  function hops(opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    onReady(() => {
      cb(null, layered.getHops(opts))
    })
  }

  // Make sure blocked peers cannot connect, default is true
  if (config.friends.hookAuth !== false) {
    authGlue(sbot, layered, isBlocking)
  }

  return {
    follow: follow,
    block: block,
    isFollowing: isFollowing,
    isBlocking: isBlocking,
    hops: hops,
    hopStream: layered.hopStream,
    graph: graph,
    graphStream: graphStream,
    help: () => help,

    // legacy, debugging
    onEdge: layered.onEdge,
    createLayer: layered.createLayer,
    get: legacy.get,
    createFriendStream: legacy.createFriendStream,
    stream: legacy.stream,
  }
}
