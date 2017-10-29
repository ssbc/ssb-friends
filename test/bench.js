

var F = require('../alg')
var G = require('graphreduce')

var g = {}
for(var i = 0; i < 10000; i++)
  //force a connected graph by always randomly connecting to a node already in the graph.

  g = G.addEdge(g,  ~~(Math.random()*i), i)

var start = Date.now()
var r = F.reachable(g, 0)

//okay this is the sort of approach we should use,
//which can handle additions quickly, but for deletions
//we need to look retraverse the whole graph
//because some routes might get longer!

function diffReachable(g, reachable, edge) {
  var A = edge.from, B = edge.to
  //check if there was already a shorter route to B
  if(reachable[A] >= reachable[B]) return {}
  var r = {}

  ;(function traverse (n, hops) {
    if(hops >= reachable[n]) return
    if(r[n] != null && r[n] <= hops) return
    r[n] = hops
    for(var m in g[n])
      traverse(m, r[n]+1)
  })(B, reachable[A]+1)
  return r
}


for(var i = 0; i < 1000; i++) {
  var a = ~~(Math.random()*1000)
  var b = ~~(Math.random()*1000)
//  console.log(a, b, r[a], r[b])
  g = G.addEdge(g, a, b)
  if(r[a] <= r[b]) {
    if(true) {
      var _r = F.diffReachable(g, r, {from:a, to:b, value: true})
      for(var k in _r)
        r[k] = _r[k]
    } else {
      var _r = F.reachable(g, 0)
      F.diff(r, _r)
      r = _r
    }
  }
//  console.log(F.diff(r, _r))

}
//console.log(r)
console.log(Date.now() - start)

