

var s = {W:true,X:true,Y:true,Z:true}
var sybils = {
  W:s,X:s,Y:s,Z:s
}

var g = {
  a: {b: true, c: true, d: true},
  b: {W: true}, //b falls for sybil, W
  c: {W: false}, //c is not fooled
  W:s,X:s,Y:s,Z:s
}

var tape = require('tape')

var F = require('../alg')
var block = require('../block')

tape('simple', function (t) {

  var g = {
    a: {b: true, c: true, d: true},
    b: {W: true}, //b falls for sybil, W
    c: {W: false}, //c is not fooled
    W:s,X:s,Y:s,Z:s
  }

  var u
  t.deepEqual(
    F.reachable(g, 'a', block),
    {
      a:[0],
      b:[1,u],
      c:[1,u],
      d:[1,u],
      W:[2,2]
  })

  t.end()

})


tape('simple', function (t) {
  var u
  var g = {
    a: {b: true, c: true, d: true},
    b: {X: false}, //b falls for sybil, W
    c: {X: true}, //c is not fooled
    W:s,X:s,Y:s,Z:s
  }

  t.deepEqual(
    F.reachable(g, 'a', block),
    {
      a:[0],
      b:[1,u],
      c:[1,u],
      d:[1,u],
      X:[2,2]
  })

  t.end()

})

tape('simple', function (t) {
  var u
  var g = {
    a: {b: true, c: true, d: true},
    b: {X: false}, //b falls for sybil, W
    c: {X: true}, //c is not fooled
    W:s,X:s,Y:s,Z:s
  }

  t.deepEqual(
    F.reachable(g, 'a', block),
    {
      a:[0],
      b:[1,u],
      c:[1,u],
      d:[1,u],
      X:[2,2]
  })

  t.end()
})

