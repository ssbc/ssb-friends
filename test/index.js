
var hops = require('../').hops
var tape = require('tape')

tape('a->b->c', function (t) {
  t.deepEqual(
    hops({
      a: {b: 1},
      b: {c: 1},
      c: {}
    }, 'a'),
    {a:0, b:1, c:2}
  )
  t.end()
})

tape('a->b=c', function (t) {
  t.deepEqual(
    hops({
      a: {b: 1},
      b: {c: 0},
      c: {b: 0}
    }, 'a'),
    {a:0, b:1, c:1}
  )
  t.end()
})

tape('a=A->b,A->c', function (t) {
  t.deepEqual(
    hops({
      a: {b: 1, A: 0},
      b: {c: 1},
      c: {},
      A: {a:0, c: 1}
    }, 'a'),
    {a:0, A:0, b:1, c:1}
  )
  t.end()
})

tape('a=A->b,A->c', function (t) {
  t.deepEqual(
    hops({
      a: {b: 1, A: 0},
      b: {c: 1},
      c: {},
      A: {a:0, c: 1}
    }, 'a'),
    {a:0, A:0, b:1, c:1}
  )
  t.end()
})

tape('a->b-2>c->d, max=3', function (t) {
  t.deepEqual(
    hops({
      a: {b: 1},
      b: {c: 2},
      c: {d: 1},
      d: {}
    }, 'a', 3),
    {a:0, b:1, c:3}
  )
  t.end()
})

tape('a->b-2>c->d, max=3', function (t) {
  t.deepEqual(
    hops({
      a: {b: 1},
      b: {c: 2},
      c: {d: 1},
      d: {}
    }, 'a', 2),
    {a:0, b:1}
  )
  t.end()
})

tape('a=A->b,A->c', function (t) {
  t.deepEqual(
    hops({
      a: {b: 1},
      b: {c: [1, 3]},
      c: {d: 1},
      d: {}
    }, 'a'),
    {a:0, b:1, c:2, d: 5}
  )
  t.end()
})

tape('A!C, A->B->C', function (t) {
  t.deepEqual(
    hops({
        a: {b: 1},
        b: {c: 1}
      },
      'a',
      2,
      {c: {a: true}}
    ),
    {
      a: 0,
      b: 1
      //c is blocked
    }
  )
  t.end()
})
//even though hops is really high, do not replicate D, since they are only
//followed by a frenemy.

tape('E!C, A->B->C->D,A->E;hops=4', function (t) {
  t.deepEqual(
    hops({
        a: {b: 1, e: 1},
        b: {c: 1}
      },
      'a',
      4,
      {c: {e: true}}
    ),
    {
      a: 0,
      b: 1,
      e: 1,
      c: 2
      //D is a foaf but also eoaf.
    }
  )
  t.end()
})

//blocked by our other device
tape('A_!C, A->B->C,A=A_', function (t) {
  t.deepEqual(
    hops({
        a: {b: 1, a_: 0},
        b: {c: 1}
      },
      'a',
      2,
      {c: {a_: true}}
    ),
    {
      a: 0,
      b: 1,
      a_: 0,
      //D is a foaf but also eoaf.
    }
  )
  t.end()
})

//loosly followed by A, but blocked by closer friend.
tape('A_!C, A->B->C,A=A_', function (t) {
  t.deepEqual(
    hops({
        a: {b: 1, c: 3},
      },
      'a',
      3,
      {c: {b: true}}
    ),
    {
      a: 0,
      b: 1,
    }
  )
  t.end()
})

//loosly followed by A, but blocked by closer friend.
tape('block and follow', function (t) {
  t.deepEqual(
    hops({
        a: {b: 1},
      },
      'a',
      1,
      {b: {a: true}}
    ),
    {
      a: 0,
//      b: 1,
    }
  )
  t.end()
})

