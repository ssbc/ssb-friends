
var F = require('../alg')
var G = require('graphreduce')
var tape = require('tape')

tape('simple', function (t) {
  var g = {}
  g = F.add(g, 'a', 'b', true)
  t.deepEqual(
    F.diffReachable(g, {a:0}, {from: 'a', to: 'b', value: true}),
    {b: 1}
  )
  g = F.add(g, 'a', 'c', true)
  t.deepEqual(
    F.diffReachable(
      g,
      {a:0,b:1},
      {from: 'a', to: 'c', value: true}
    ),
    {c: 1}
  )
  g = F.add(g, 'b', 'd', true)
  t.deepEqual(
    F.diffReachable(
      g,
      {a:0,b:1, c: 1},
      {from: 'b', to: 'd', value: true}
    ),
    {d: 2}
  )

  t.deepEqual(g, {
    a: {b: true, c: true},
    b: {d: true}
  })

  t.deepEqual(F.reachable(g, 'a'), {
    a: 0, b: 1, c: 1, d: 2
  })

  t.end()

})

tape('shorten!', function (t) {
  var g = {
    a: {b: true},
    b: {c: true},
    c: {d: true, e: true, f: true}
  }
  var r = {a: 0, b:1, c: 2, d: 3, e:3, f:3}
  t.deepEqual(F.reachable(g, 'a'), r)
  g = F.add(g, 'a', 'c', true)
  var d = {c:1, d:2,e:2,f:2}
  t.deepEqual(F.diff(r, F.reachable(g, 'a')), d)

  t.deepEqual(
    F.diffReachable(g, r, {from: 'a', to: 'c', value: true}),
    d
  )

  t.end()
})

tape('chain', function (t) {
  var g = {}
  g = F.add(g, 'a', 'b', true)
  g = F.add(g, 'b', 'c', true)
  g = F.add(g, 'c', 'd', true)

  t.deepEqual(g, {
    a: {b: true},
    b: {c: true},
    c: {d: true}
  })

  t.deepEqual(F.reachable(g, 'a'), {
    a: 0, b: 1, c: 2, d: 3
  })

  t.end()

})

tape('chain, with remove', function (t) {
  var g = {}
  g = F.add(g, 'a', 'b', true)
  g = F.add(g, 'b', 'c', true)
  g = F.add(g, 'c', 'd', true)

  var r1 = F.reachable(g, 'a')
  t.deepEqual(r1, {
    a: 0, b: 1, c: 2, d: 3
  })

  g = F.add(g, 'b', 'c', null)
  t.deepEqual(g, {
    a: {b: true},
    b: {},
    c: {d: true}
  })
  var r2 = F.reachable(g, 'a')
  t.deepEqual(r2, {
    a: 0, b: 1
  })

  g = F.add(g, 'a', 'c', true)

  t.deepEqual(g, {
    a: {b: true, c: true},
    b: {},
    c: {d: true}
  })

  t.deepEqual(F.reachable(g, 'a'), {
    a: 0, b: 1, c: 1, d: 2
  })

  t.end()
})

tape('chain, with block', function (t) {
  var g = {}
  g = F.add(g, 'a', 'b', false)
  g = F.add(g, 'a', 'c', true)
  g = F.add(g, 'a', 'd', true)
  g = F.add(g, 'c', 'b', true)
  g = F.add(g, 'd', 'b', true)

  t.deepEqual(g, {
    a: {b: false, c: true, d: true},
    c: {b: true},
    d: {b: true}
  })

  var r1 = F.reachable(g, 'a')
  t.deepEqual(r1, {
    a: 0, b: -1, c: 1, d: 1
  })

  //since b is blocked, we don't care who their friends are
  g = F.add(g, 'b', 'e')

  t.deepEqual(g, {
    a: {b: false, c: true, d: true},
    c: {b: true},
    d: {b: true},
    b: {e: true}
  })

  //no change, because b was blocked
  var r2 = F.reachable(g, 'a')
  t.deepEqual(r2, {
    a: 0, b: -1, c: 1, d: 1
  })

  t.deepEqual(F.diff(r1, r2), {})

  t.end()

})

tape('chain, with block at hop 2', function (t) {
  var g = {}
  g = F.add(g, 'a', 'b', true)
  g = F.add(g, 'a', 'c', true)

  g = F.add(g, 'b', 'd', false)
  g = F.add(g, 'c', 'd', true)

  t.deepEqual(g, {
    a: {b: true, c: true},
    b: {d: false},
    c: {d: true}
  })

  t.deepEqual(F.reachable(g, 'a'), {
    a: 0, b: 1, c: 1, d: -2
  })

  t.end()
})

tape('chain, with block at hop 2, but follow then block!', function (t) {
  var g = {}
  g = F.add(g, 'a', 'b', true)
  g = F.add(g, 'a', 'c', true)

  g = F.add(g, 'b', 'd', true)

  t.deepEqual(g, {
    a: {b: true, c: true},
    b: {d: true},
  })

  var r1 = F.reachable(g, 'a')

  t.deepEqual(r1, {
    a: 0, b: 1, c: 1, d: 2
  })

  g = F.add(g, 'c', 'd', false)

  t.deepEqual(g, {
    a: {b: true, c: true},
    b: {d: true},
    c: {d: false}
  })

  var r2 = F.reachable(g, 'a')
  t.deepEqual(r2, {
    a: 0, b: 1, c: 1, d: -2
  })

  t.deepEqual(F.diff(r1, r2), {
      d: -2
  })

  t.end()
})




