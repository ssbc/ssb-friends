'use strict'
const LayeredGraph = require('layered-graph')
const isFeed = require('ssb-ref').isFeed
const contacts = require('./contacts')
const db2Contacts = require('./db2-contacts')
const _legacy = require('./legacy')
const help = require('./help')

// glue
const authGlue = require('./glue/auth')
const replicateEBTGlue = require('./glue/replicate')

// friends plugin
// methods to analyze the social graph
// maintains a 'follow' and 'flag' graph

exports.name = 'friends'
exports.version = '1.0.0'
exports.manifest = {
  hopStream: 'source',
  onEdge: 'sync',
  follow: 'async',
  isFollowing: 'async',
  block: 'async',
  isBlocking: 'async',
  hops: 'async',
  help: 'sync',
  // createLayer: 'sync',       // not exposed over RPC as returns a function
  get: 'async', //                 legacy
  createFriendStream: 'source', // legacy
  stream: 'source' //              legacy
}

exports.init = function (sbot, config) {
  const max = (config.friends && config.friends.hops) || (config.replicate && config.replicate.hops) || 3
  const layered = LayeredGraph({ max: max, start: sbot.id })

  function isFollowing (opts, cb) {
    layered.onReady(function () {
      const g = layered.getGraph()
      cb(null, g[opts.source] ? g[opts.source][opts.dest] >= 0 : false)
    })
  }

  function isBlocking (opts, cb) {
    layered.onReady(function () {
      const g = layered.getGraph()
      cb(null, Math.round(g[opts.source] && g[opts.source][opts.dest]) === -1)
    })
  }

  if (sbot.db)
    sbot.db.registerIndex(db2Contacts(layered.createLayer))
  else
    contacts(sbot, layered.createLayer, config)

  const legacy = _legacy(layered)

  // glue modules together
  if (config.friends && config.friends.hookAuth !== false)
    authGlue(sbot, isBlocking)

  if (config.friends && config.friends.hookReplicate !== false)
    replicateEBTGlue(sbot, layered, legacy)

  return {
    hopStream: layered.hopStream,
    onEdge: layered.onEdge,
    follow (feedId, opts, cb) {
      if (!isFeed(feedId)) return cb(new Error(`follow requires a feedId, got ${feedId}`))
      opts = opts || {}

      const content = {
        type: 'contact',
        contact: feedId,
        following: 'state' in opts ? opts.state : true,
        recps: opts.recps
      }
      sbot.publish(content, cb)
    },
    block (feedId, opts, cb) {
      if (!isFeed(feedId)) return cb(new Error(`follow requires a feedId, got ${feedId}`))
      opts = opts || {}

      const content = {
        type: 'contact',
        contact: feedId,
        blocking: 'state' in opts ? opts.state : true,
        reason: typeof opts.reason === 'string' ? opts.reason : undefined,
        recps: opts.recps
      }
      sbot.publish(content, cb)
    },
    isFollowing: isFollowing,
    isBlocking: isBlocking,

    // expose createLayer, so that other plugins may express relationships
    createLayer: layered.createLayer,

    // legacy, debugging
    hops (opts, cb) {
      if (typeof opts === 'function') {
        cb = opts
        opts = {}
      }

      layered.onReady(function () {
        if (sbot.db)
          sbot.db.onDrain('contacts', () => cb(null, layered.getHops(opts)))
        else
          cb(null, layered.getHops(opts))
      })
    },
    help: () => help,
    // legacy
    get: legacy.get,
    createFriendStream: legacy.createFriendStream,
    stream: legacy.stream
  }
}
