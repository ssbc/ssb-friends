var pull = require('pull-stream')
var tape = require('tape')
var crypto  = require('crypto')

var createSbot = require('secret-stack')({
    caps: {shs: crypto.randomBytes(32).toString('base64')}
  })
  .use(require('ssb-db'))
  .use(require('ssb-replicate'))
  .use(require('..'))

var botA = createSbot({
  temp: 'alice',
  port: 45451,
  host: 'localhost',
  timeout: 20001,
  replicate: {
    hops: 100,
    legacy: false
  }
})

tape('empty database follow self', function (t) {
  pull(
    botA.friends.createFriendStream(),
    pull.collect(function (err, a) {
      t.error(err)
      t.deepEqual(a, [botA.id])
      t.end()
    })
  )
})

var gen = require('ssb-generate')

tape('live follows works', function (t) {
  var a = []

  pull(
    botA.friends.createFriendStream({
      live: true,
      meta: true,
      hops: 10
    }),
    pull.drain(function (m) {
      a.push(m)
    })
  )

  gen.initialize(botA, 10, 2, function (err, peers, hops) {
    t.error(err)

    console.log(a.length, hops)

    var seen = {}
    var count = 0
    var notSeen = {}

    peers.forEach(function (v) {
      notSeen[v.id] = true
    })

    a.forEach(function (v) {
      if (!seen[v.id]) {
        seen[v.id] = true
        delete notSeen[v.id]
        count++
      }
    })

    botA.friends.hops(function (err, hops) {
      t.error(err)
      for (var k in notSeen) { console.log('NS', k, hops[k]) }
    })

    t.deepEqual(notSeen, {})
    t.deepEqual(count, peers.length, 'all peers streamed')
    //    b.forEach(function (e) { t.ok(e.hops <= 1, 'b '+e.hops+' hops <= 1') })
    //    c.forEach(function (e) { t.ok(e.hops <= 2, 'c '+e.hops+' hops <= 2') })
    //    t.ok(a.length >= b.length, '1 hops')
    //    t.ok(c.length >= b.length, '2 hops')
    //
    t.end()
    botA.close()
  })
})


