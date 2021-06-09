const pull = require('pull-stream')

module.exports = function replicationGlue(sbot, layered, legacy) {
  // check for ssb-replicate or similar, but with a delay so other plugins have time to be loaded
  setImmediate(() => {
    if (!sbot.replicate) {
      throw new Error('ssb-friends expects a replicate plugin to be available')
    }

    function updateEdge(orig, dest, value) {
      if (orig === sbot.id) sbot.replicate.request(dest, !!value)
      if (dest !== sbot.id) sbot.replicate.block(orig, dest, value === false)
    }

    sbot.replicate.request(sbot.id, true)

    pull(
      legacy.stream({ live: true }),
      pull.filter(contacts => !!contacts),
      pull.drain((contacts) => {
        if (contacts.from && contacts.to) {
          updateEdge(contacts.from, contacts.to, contacts.value)
        } else {
          for (const from of Object.keys(contacts)) {
            for (const to of Object.keys(contacts[from])) {
              updateEdge(from, to, contacts[from][to])
            }
          }
        }
      })
    )
  })
}
