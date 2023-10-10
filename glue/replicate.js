/* eslint-disable brace-style */
const pull = require('pull-stream')
const pullFlatMap = require('pull-flatmap')

module.exports = function replicationGlue (sbot, layered, legacy) {
  // check for ssb-replicate or similar, but with a delay so other plugins have time to be loaded
  setImmediate(() => {
    if (!sbot.replicate) {
      throw new Error('ssb-friends expects a replicate plugin to be available')
    }

    const maxHops = layered.max || 3

    pull(
      layered.hopStream({ live: true }),
      pullFlatMap(update => Object.entries(update)),
      pull.drain(([feedId, hops]) => {
        // replicate
        if (hops >= 0 && hops <= maxHops) {
          // sbot.replicate.block(sbot.id, feedId, false)
          sbot.replicate.request(feedId, true)
        }
        // block
        else if (hops === -1) {
          sbot.replicate.block(sbot.id, feedId, true)
          // sbot.replicate.request(feedId, false)
        }
        // unfollow / unblock
        else if (hops === -2) {
          sbot.replicate.block(sbot.id, feedId, false)
          sbot.replicate.request(feedId, false)
        }
        else {
          console.error('ssb-friends/glue/replicate unknown state:', { feedId, hops })
        }
      })
    )
  })
}
