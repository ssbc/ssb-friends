'use strict'
const LayeredGraph = require('layered-graph')
const pull = require('pull-stream')
const isFeed = require('ssb-ref').isFeed
const contacts = require('./contacts')
const _legacy = require('./legacy')
const help = require('./help')
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

  // opinion: do not authorize peers blocked by this node.
  sbot.auth.hook(function (fn, args) {
    const self = this
    isBlocking({ source: sbot.id, dest: args[0] }, (err, blocked) => {
      if (err) console.error(err)

      if (blocked) args[1](new Error('client is blocked'))
      else fn.apply(self, args)
    })
  })

  contacts(sbot, layered.createLayer, config)

  const legacy = _legacy(layered)

  // check for ssb-replicate or similar, but with a delay so other plugins have time to be loaded
  setImmediate(function () {
    if (!sbot.replicate) {
      throw new Error('ssb-friends expects a replicate plugin to be available')
    }

    // opinion: replicate with everyone within max hops (max passed to layered above ^)
    pull(
      layered.hopStream({ live: true, old: true }),
      pull.drain(function (data) {
        if (data.sync) return
        for (const k in data) {
          sbot.replicate.request(k, data[k] >= 0)
        }
      })
    )

    // opinion: pass the blocks to replicate.block
    const block = (sbot.replicate && sbot.replicate.block) || (sbot.ebt && sbot.ebt.block)
    if (block) {
      function handleBlockUnlock (from, to, value) {
        if (value === false) block(from, to, true)
        else block(from, to, false)
      }
      pull(
        legacy.stream({ live: true }),
        pull.drain(function (contacts) {
          if (!contacts) return

          if (isFeed(contacts.from) && isFeed(contacts.to)) { // live data
            handleBlockUnlock(contacts.from, contacts.to, contacts.value)
          } else { // initial data
            for (const from in contacts) {
              const relations = contacts[from]
              for (const to in relations) { handleBlockUnlock(from, to, relations[to]) }
            }
          }
        })
      )
    }
  })

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
    // block,
    isBlocking: isBlocking,

    // expose createLayer, so that other plugins may express relationships
    createLayer: layered.createLayer,

    // legacy, debugging
    hops (opts, cb) {
      layered.onReady(function () {
        if (typeof opts === 'function') {
          cb = opts
          opts = {}
        }
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
