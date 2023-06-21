const pull = require('pull-stream')

module.exports = function replicationGlue(sbot, layered, legacy) {
  // check for ssb-replicate or similar, but with a delay so other plugins have time to be loaded
  setImmediate(() => {
    if (!sbot.replicate) {
      throw new Error('ssb-friends expects a replicate plugin to be available')
    }

    const follows = {
      dev1: {
        pataka: true
      },
      dev2: {
        pataka: true
      },
      pataka: {
        dev1: true,
        dev2: true
      }
    }

    function updateEdge(orig, dest, value) {
      if (orig === sbot.id) sbot.replicate.request(dest, value !== false)
      if (dest !== sbot.id) sbot.replicate.block(orig, dest, value === false)
    }

    sbot.replicate.request(sbot.id, true)

    pull(
      legacy.stream(),
      pull.filter(contacts => !!contacts),
      pull.drain((contacts) => {
        if (contacts.from && contacts.to) {
          updateEdge(contacts.from, contacts.to, contacts.value)
        } else {
          for (const from of Object.keys(contacts)) {
            for (const to of Object.keys(contacts[from])) {
              updateEdge(from, to, contacts[from][to])

              // HACK 2023-06-21 mix
              // this code is here to patch a problem where this function does not at all honour
              // config.friends.hops
              // This code below *hard codes* a transitive replication of 2 hops
              //
              // TODO
              // - update this to honour hops
              // - perhaps instead look at how this was ever working
              //    - why would this stream produce two different shapes of data D:
              //    - what changed that this used to work?
              //        - what version was this change in?
              if (from === sbot.id) {
                const ourFollows = Object.keys(contacts[from]).filter(id => contacts[from][id])
                const theirFollows = ourFollows.flatMap(id => {
                  return Object.keys(contacts[id]).filter(id2 => contacts[id][id2])
                })
                theirFollows.forEach(id => updateEdge(from, id, true))
              }
            }
          }
        }
      })
    )
  })
}
