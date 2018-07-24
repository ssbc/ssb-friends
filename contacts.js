var Reduce = require('flumeview-reduce')
//track contact messages, follow, unfollow, block

module.exports = function (sbot, createLayer, config) {

  var layer = createLayer('contacts')

  var g, _g
  var hops = {}
  hops[sbot.id] = 0
  var index = sbot._flumeUse('friends', Reduce(2, function (__g, data) {
    if(!g) {
      layer(g = {})
    }

    var from = data.value.author
    var to = data.value.content.contact
    var value =
      data.value.content.following === true ? 1 :
      data.value.content.following === false ? -2 :
      data.value.content.blocking || data.value.content.flagged ? -1
      : null
    if(from && to && value != null)
      return layer(from, to, value)
    return g
  }))
}


