const Reduce = require('flumeview-reduce')
const isFeed = require('ssb-ref').isFeed
// track contact messages, follow, unfollow, block

module.exports = function (sbot, createLayer) {
  const updatePublicLayer = createLayer('contactsPublic')
  const updatePrivateLayer = createLayer('contactsPrivate')
  let initial = false

  const INDEX_VERSION = 11
  const index = sbot._flumeUse('contacts2', Reduce(INDEX_VERSION, (g, data) => {
    if (!g) g = {}

    const source = data.value.author
    const dest = data.value.content.contact
    const edgeValue =
      data.value.content.blocking || data.value.content.flagged
        ? -1
        : data.value.content.following === true
          ? 1
          : -2
    const privately = data.value.meta && data.value.meta.private

    if (isFeed(source) && isFeed(dest)) {
      if (initial) {
        if (privately) {
          updatePrivateLayer(source, dest, edgeValue)
        } else {
          updatePublicLayer(source, dest, edgeValue)
        }
      }
      g[source] = g[source] || {}
      if (privately) {
        g[source][dest] = 'p' + edgeValue
      } else {
        g[source][dest] = edgeValue
      }
    }
    return g
  }))

  // trigger flume machinery to wait until index is ready,
  // otherwise there is a race condition when rebuilding the graph.
  index.get((err, g) => {
    if (err) throw err
    initial = true

    if (!g) {
      updatePublicLayer({})
      updatePrivateLayer({})
      return
    }

    // Split g into public and private layers
    const publicLayer = {}
    const privateLayer = {}
    for (const source of Object.keys(g)) {
      for (const dest of Object.keys(g[source])) {
        const val = g[source][dest]
        const privately = val[0] === 'p'
        if (privately) {
          const edgeValue = parseInt(val.slice(1), 10)
          privateLayer[source] = privateLayer[source] || {}
          privateLayer[source][dest] = edgeValue
        } else {
          publicLayer[source] = publicLayer[source] || {}
          publicLayer[source][dest] = val
        }
      }
    }

    updatePublicLayer(publicLayer)
    updatePrivateLayer(privateLayer)
  })
}
