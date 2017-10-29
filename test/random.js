

var tape = require('tape')
var F = require('../alg')
var G = require('graphreduce')

var N = 100
//random graph

tape('random graph, compare diffs', function (t) {
  var g = {}
  for(var i = 0; i < N; i++) {
    var reachable = F.reachable(g, 0)
    var edge = {from:~~(Math.random()*i), to: i, value:true}
    G.addEdge(g, edge.from, edge.to, edge.value)
    var patch = F.diffReachable(g, reachable, edge)
    var _reachable = F.reachable(g, 0)
    var _patch = F.diff(reachable, _reachable)
    t.deepEqual(patch, _patch)
    for(var k in patch)
      if(patch[k] > reachable[k])
        throw new Error('if only add edges, hops should never get bigger')

  }
  for(var i = 0; i < N; i++) {

    var reachable = F.reachable(g, 0)
    var edge = {from:~~(Math.random()*N), to: ~~(Math.random()*N), value:true}
    G.addEdge(g, edge.from, edge.to, edge.value)
    console.log('edge', edge)
    var patch = F.diffReachable(g, reachable, edge)
    var _reachable = F.reachable(g, 0)
    var _patch = F.diff(reachable, _reachable)
    t.deepEqual(patch, _patch, 'patches are equal')
//    for(var k in patch)
//      if(patch[k] > reachable[k])
//        throw new Error('if only add edges, hops should never get bigger')

  }

  t.end()
})

// I was getting a infinite loop running this with scuttlebot
// tests and I couldn't figure out why. This didn't reproduce it.

tape('flat random!', function (t) {
  var g = {}, N = 100
  for(var i = 0; i < N*100; i++) {
    var edge = {
      from: ~~(Math.random()*N),
      to: ~~(Math.random()*N),
      value: true
    }
    var r = F.reachable(g, 0)
    g = G.addEdge(g, g.from, g.to, g.value)
    F.diffReachable(g, r, edge)
  }
  t.end()
})

var block = require('../block')

tape('random graph, block settings', function (t) {

  var g = {}
  for(var i = 0; i < N; i++) {
    var reachable = F.reachable(g, 0, block)
    var edge = {from:~~(Math.random()*i), to: i, value:true}
    G.addEdge(g, edge.from, edge.to, edge.value)
    var patch = F.diffReachable(g, reachable, edge, block)
    var _reachable = F.reachable(g, 0, block)
    var _patch = F.diff(reachable, _reachable, block)
    t.equal(Object.keys(_reachable).length, i+1)
    t.deepEqual(patch, _patch)
    for(var k in patch)
      if(patch[k] > reachable[k])
        throw new Error('if only add edges, hops should never get bigger')
  }

//  console.log(F.reachable(g, 0))
  t.end()

})

