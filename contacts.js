const Reduce = require('flumeview-reduce')
const isFeed = require('ssb-ref').isFeed
// track contact messages, follow, unfollow, block

module.exports = function (sbot, createLayer, config) {
  const layer = createLayer('contacts')
  let initial = false

  const INDEX_VERSION = 10
  const index = sbot._flumeUse('contacts2', Reduce(INDEX_VERSION, (g, data) => {
    if (!g) g = {}

    const from = data.value.author
    const to = data.value.content.contact
    const value = (data.value.content.blocking || data.value.content.flagged)
      ? -1
      : (data.value.content.following === true) ? 1 : -2

    if (isFeed(from) && isFeed(to)) {
      if (initial) {
        layer(from, to, value)
      }
      g[from] = g[from] || {}
      g[from][to] = value
    }
    return g
  }))

  // trigger flume machinery to wait until index is ready,
  // otherwise there is a race condition when rebuilding the graph.
  index.get((err, g) => {
    if (err) throw err
    initial = true
    layer(g || {})
  })
}
