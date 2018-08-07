var pull = require('pull-stream')
var tape = require('tape')
var createSbot = require('scuttlebot')
  .use(require('scuttlebot/plugins/replicate'))
  .use(require('../'))

  var a_bot = createSbot({
    temp: 'alice',
    port: 45451, host: 'localhost', timeout: 20001,
    replicate: {hops: 100, legacy: false},
//    keys: alice
  })

tape('empty database follow self', function (t) {

  pull(
    a_bot.friends.createFriendStream(),
    pull.collect(function (err, a) {
      t.deepEqual(a, [a_bot.id])
      t.end()
    })
  )
})

var gen = require('ssb-generate')

tape('live follows works', function (t) {
  var a = []

  pull(
    a_bot.friends.createFriendStream({live: true, meta: true, hops: 10}),
    pull.drain(function (m) {
      a.push(m)
    })
  )

  gen.initialize(a_bot, 10, 2, function (err, peers, hops) {
    console.log(a.length, hops)
    var seen = {}, count = 0, notSeen = {}
    peers.forEach(function (v) {
      notSeen[v.id] = true
    })
    a.forEach(function (v) {
      if(!seen[v.id]) {
        seen[v.id] = true
        delete notSeen[v.id]
        count ++
      }
    })
    a_bot.friends.hops(function (err, hops) {
      for(var k in notSeen)
        console.log("NS", k, hops[k])
    })
    t.deepEqual(notSeen, {})
    t.deepEqual(count, peers.length, 'all peers streamed')
//    b.forEach(function (e) { t.ok(e.hops <= 1, 'b '+e.hops+' hops <= 1') })
//    c.forEach(function (e) { t.ok(e.hops <= 2, 'c '+e.hops+' hops <= 2') })
//    t.ok(a.length >= b.length, '1 hops')
//    t.ok(c.length >= b.length, '2 hops')
//
    t.end()
    a_bot.close()
  })

})









