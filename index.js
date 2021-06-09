'use strict'
const LayeredGraph = require('layered-graph')
const isFeed = require('ssb-ref').isFeed
const contacts = require('./contacts')
const db2Contacts = require('./db2-contacts')
const setupLegacy = require('./legacy')
const help = require('./help')
const authGlue = require('./glue/auth')
const replicationGlue = require('./glue/replicate')

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

  // legacy:
  get: 'async',
  createFriendStream: 'source',
  stream: 'source'
}

exports.init = function (sbot, config) {
  if (!config.friends) config.friends = {}
  if (!config.replicate) config.replicate = {}
  const max = config.friends.hops || config.replicate.hops || 3
  const layered = LayeredGraph({ max: max, start: sbot.id })

  if (sbot.db) {
    sbot.db.registerIndex(db2Contacts(layered.createLayer))
  } else {
    contacts(sbot, layered.createLayer, config)
  }

  const legacy = setupLegacy(layered)

  function isFollowing (opts, cb) {
    layered.onReady(() => {
      const g = layered.getGraph()
      cb(null, g[opts.source] ? g[opts.source][opts.dest] >= 0 : false)
    })
  }

  function isBlocking (opts, cb) {
    layered.onReady(() => {
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

  function hops (opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    layered.onReady(() => {
      if (sbot.db) {
        sbot.db.onDrain('contacts', () => cb(null, layered.getHops(opts)))
      } else {
        cb(null, layered.getHops(opts))
      }
    })
  }

  // glue modules together
  if (config.friends.hookAuth !== false) // defaults to true
    authGlue(sbot, isBlocking)

  if (config.friends.hookReplicate !== false) // defaults to true
    replicationGlue(sbot, layered)

  return {
    hopStream: layered.hopStream,
    onEdge: layered.onEdge,
    follow: follow,
    block: block,
    isFollowing: isFollowing,
    isBlocking: isBlocking,

    // expose createLayer, so that other plugins may express relationships
    createLayer: layered.createLayer,

    // legacy, debugging
    hops: hops,
    help: () => help,
    // legacy
    get: legacy.get,
    createFriendStream: legacy.createFriendStream,
    stream: legacy.stream
  }
}
