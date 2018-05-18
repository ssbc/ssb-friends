

/*
I need to merge multiple sources about links between peers.

there are follow messages.
there are same-as messages.
there are user-invites.

follow messages have a hops count of 1.
so do user-invites.

same-as have a count of zero.

hmm. Okay, so I want to have this as 3 separate modules.
there may be other ways in express relatedness of peers in the future.

two ideas:
  N separate follow graphs, that are merged.

  Each link in the graph has a sequence/timestamp, that is used to sort.
  then we know wether one link should override another.

  I'm just gonna code up both of these and see what happens.
*/

function isEmpty (o) {
  for(var k in o) return false
  return true
}

function getHopsTo(dest) {
  return Array.isArray(dest) ? +dest[0] : +dest
}
function getHopsFrom(dest) {
  return Array.isArray(dest) ? +dest[1] : +dest
}

function getBlockHops (blocks, target, hops) {
  if(!blocks[target]) return Infinity
  var min = Infinity
  for(var k in blocks[target]) {
    if(hops[k] == 0) return 0
    min = Math.min(min, hops[k])
  }
  return min
}

function hops (follows, start, max, blocks) {
  var hops = {}
  var blocks = blocks || {}
  max = max || Infinity //max || Number.infinity
  var next = {}
  var count = next[start] = hops[start] = 0
  while(!isEmpty(next)) {
    for(var j in next) {
      if(hops[j] < max)
        for(var k in follows[j]) {
          var step = +next[j] + getHopsTo(follows[j][k])
          var _hops = hops[k] == null ? step : Math.min(hops[k]|0, step)
          var blockHops = getBlockHops(blocks, k, hops) +1
          if(
            _hops <= max
            && (blockHops >= _hops && blockHops != 1)
          ) {
            if(
              hops[k] == null
              //&& !isDirectlyBlocked
            ) next[k] = +next[j] + getHopsFrom(follows[j][k])
           //  _hops
            hops[k] = _hops
          }
        }
      delete next[j]
    }
  }
  return hops
}

module.exports = function (state) {
  return hops(state.follows, state.id, state.hops, state.blocked)
}

module.exports.hops = hops

