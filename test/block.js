var tape = require('tape')
var G = require('graphreduce')

var block = require('../block')
var F = require('../alg')

tape('block rules', function (t) {

  t.equal(block.expand([0,1]), true, 'expand ourselves!')
  t.equal(block.expand([1,2]), true, 'expand someone we follow directly!')
  t.equal(block.expand([2,2]), false, 'do not expand someone that is blocked by foaf, if we are only following them for the same reason.!')
  t.equal(block.expand([2,3]), true, 'expand if foaf follows, and fofoaf blocks')

  t.end()
})
var u
tape('update?', function (t) {
  t.equal(block.update([u, 1], [2,1]), false, 'unfollowed directly')
  t.equal(block.update([u, 2], [1,2]), true)
  t.equal(block.update([2, u], [u,2]), true)
  t.equal(block.update([u, 1], [1,u]), true, 'started follownig')
  t.equal(block.update([u, 1], [u,2]), false)
  t.equal(block.update([0], [0, u]), false)
  t.equal(block.update([0], [0, 2]), false)
  t.equal(block.update([2, u], [1,u]), true)
  t.equal(block.update([3, u], [2,u]), true)

  t.end()

})

//tape('compare', function (t) {
//  t.equal(block.compare([1, 2], [undefined, 2]), -1)
//  t.equal(block.compare([undefined, 2], [1, 2]), 1)
//  t.end()
//
//})

tape('block reduces', function (t) {
  t.deepEqual(block.reduce(null, [1], true), [2, undefined])
  t.deepEqual(block.reduce([2], [2], true), [2, undefined])

  //followed directly, but also by a foaf
  t.deepEqual(block.reduce([1], [2], true), [1, undefined])

  //followed directly, but blocked by a foaf
  t.deepEqual(block.reduce([1], [1], false), [1, 2])
  t.deepEqual(block.reduce([1], [2], false), [1, 3])

  //followed by a foaf, but and blocked by a foaf also
  t.deepEqual(block.reduce([2], [1], false), [2, 2])

  //followed by a foaf, but and blocked by a eoaf also
  //then their opinion doesn't count
  t.deepEqual(block.reduce([2], [2, 2], false), [2])

  //blocked by a friend who is eoaf
  t.deepEqual(block.reduce([2], [1,2], false), [2, 2])

  //followed by a feoaf
  t.deepEqual(block.reduce(null, [2,2], true), null)

  t.end()
})

tape('networks', function (t) {
  g = {
    a: {b: true, c: true},
    b: {c: true, d: false},
    c: {d: true},
    //e is followed by d, but we don't replicate because they
    //are a frenemy
    d: {e: true},
    e: {a: true}
  }

  console.log(F.reachable(g, 'a', block))
  var u
  var r1 = F.reachable(g, 'a', block)
  t.deepEqual(r1,
  {
    a: [0], b: [1, u], c: [1,u], d:[2,2]
  })

  //but if c says they are alright, that is different.
  g.c.e = true

  var r2 = F.reachable(g, 'a', block)
  t.deepEqual(r2,
  {
    a: [0, u], b: [1, u], c: [1,u], d:[2,2], e: [2,u]
  })

  t.deepEqual(F.diff(r1, r2, block), {
    e: [2,u]
  })

  t.end()

})

tape('networks2', function (t) {
  var g = {
    a: {b: true},
    c: {a: true},
  }

  var r1 = F.reachable(g, 'c', block)
  t.deepEqual(r1.b, [2, undefined])

  g.a.b = false
  var r2 = F.reachable(g, 'c', block)
  t.deepEqual(r2.b, [undefined, 2])


  g.c.b = true
  var r3 = F.reachable(g, 'c', block)
  console.log(r3)
  t.deepEqual(r3.b, [1, 2])

  t.deepEqual(F.diff(r2, r3, block), {b: [1,2]})

//  console.log(, )
//  var u
//  var r1 = F.reachable(g, 'a', block)
//  t.deepEqual(r1,
//  {
//    a: [0], b: [1, u], c: [1,u], d:[2,2]
//  })
//
//  //but if c says they are alright, that is different.
//  g.c.e = true
//
//  var r2 = F.reachable(g, 'a', block)
//  t.deepEqual(r2,
//  {
//    a: [0, u], b: [1, u], c: [1,u], d:[2,2], e: [2,u]
//  })
//
//  t.deepEqual(F.diff(r1, r2, block), {
1//    e: [2,u]
//  })
//
  t.end()

})

tape('block graphs', function (t) {

  function testReachable (g, edge) {
    var reachable = F.reachable(g, 0, block)
    G.addEdge(g, edge.from, edge.to, edge.value)
    var patch = F.diffReachable(g, reachable, edge, block)
    var _reachable = F.reachable(g, 0, block)
    var _patch = F.diff(reachable, _reachable, block)
    t.deepEqual(_patch, patch)
  }

  var g = {}
  testReachable(g, {from:0, to: 0, value: true})
  t.end()
})


