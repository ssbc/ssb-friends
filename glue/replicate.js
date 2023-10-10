/* eslint-disable brace-style */
const pull = require('pull-stream')
const pullFlatMap = require('pull-flatmap')
const { promisify: p } = require('util')

module.exports = async function replicationGlue (sbot, layered, legacy) {
  const maxHops = layered.max || 3
  let isJumpStarting = false
  let isClosing = false
  let isInviteDancing = false

  // check for ssb-replicate or similar, but with a delay so other plugins have time to be loaded
  await p(setImmediate)()
  if (!sbot.replicate) {
    throw new Error('ssb-friends expects a replicate plugin to be available')
  }

  pull(
    layered.hopStream({ live: true }),
    pullFlatMap(update => Object.entries(update)),
    pull.drain(([feedId, hops]) => {
      // replicate
      if (hops >= 0 && hops <= maxHops) {
        // sbot.replicate.block(sbot.id, feedId, false)
        sbot.replicate.request(feedId, true)
        hackyConnJumpStart()
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

  // 2023-10-10 mix
  // we saw a problem where post invite acceptance, replication isn't happening till a restart
  // this hack turns conn on and off, which is a crude way to stimulate replication!
  async function hackyConnJumpStart () {
    // dont't run if already running, or shutting down
    if (isJumpStarting || isClosing) return
    // don't run if not recently involved in an invite dance
    if (!isInviteDancing) return
    if (!sbot.conn) return

    isJumpStarting = true

    // wait a moment for ssb-invite to finish exchanges of messages
    await p(setTimeout)(500)
    if (isClosing) return
    sbot.conn.stop()

    // wait a moment for conn to shut down
    await p(setTimeout)(500)
    if (isClosing) return
    sbot.conn.start()

    isJumpStarting = false
  }

  sbot.close.hook(function (close, args) {
    isClosing = true
    close.apply(this, args)
  })

  if (sbot.invite) {
    const GRACE_PERIOD = 5000
    sbot.invite.accept.hook(function (accept, args) {
      isInviteDancing = true
      setTimeout(() => {
        isInviteDancing = false
      }, GRACE_PERIOD)
      accept.apply(this, args)
    })
    sbot.invite.use.hook(function (use, args) {
      isInviteDancing = true
      setTimeout(() => {
        isInviteDancing = false
      }, GRACE_PERIOD)
      use.apply(this, args)
    })
  }
}
