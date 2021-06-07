const pull = require('pull-stream')

module.exports = function (sbot, layered) {
  // check for ssb-replicate or similar, but with a delay so other plugins have time to be loaded
  setImmediate(function () {
    if (!sbot.replicate) {
      throw new Error('ssb-friends expects a replicate plugin to be available')
    }

    const request = (sbot.replicate.request)
    const block = (sbot.replicate.block) || (sbot.ebt && sbot.ebt.block)

    // opinion: replicate with everyone within max hops (max passed to layered above ^)
    pull(
      layered.hopStream({ live: true, old: true }),
      pull.drain((hopsData) => {
        if (hopsData.sync) return
        for (const feedId of Object.keys(hopsData)) {
          const val = hopsData[feedId]
          if (val >= 0) request(feedId, true)
          if (val === -1) block(sbot.id, feedId, true)
          if (val === -2) block(sbot.id, feedId, false)
        }
      })
    )
  })
}
