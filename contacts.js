var Reduce = require('flumeview-reduce')
var isFeed = require('ssb-ref').isFeed
// track contact messages, follow, unfollow, block

module.exports = function (sbot, createLayer, config) {
  var layer = createLayer('contacts')
  var initial = false
  var hops = {}
  hops[sbot.id] = 0

  const INDEX_VERSION = 10
  var index = sbot._flumeUse('contacts2', Reduce(INDEX_VERSION, function (g, data) {
    if (!g) g = {}

    var from = data.value.author
    var to = data.value.content.contact
    var value =
      data.value.content.blocking || data.value.content.flagged ? -1
        : data.value.content.following === true ? 1
          : -2

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
  index.get(function (err, g) {
    if (err) throw err
    initial = true
    layer(g || {})
  })
}
