const isFeed = require('ssb-ref').isFeed
const pull = require('pull-stream')

module.exports = function (sbot, layered) {
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
}
