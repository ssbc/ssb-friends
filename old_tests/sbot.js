var pull = require('pull-stream')
var tape = require('tape')
var createSbot = require('scuttlebot')
  .use(require('scuttlebot/plugins/replicate'))
  .use(require('../'))

  var a_bot = createSbot({
    temp: 'alice',
    port: 45451, host: 'localhost', timeout: 20001,
    replicate: {hops: 3, legacy: false},
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
  var a = [], b = [], c = []

  pull(
    a_bot.friends.createFriendStream({live: true, meta: true, hops: 10}),
    pull.drain(function (m) { a.push(m) })
  )

  pull(
    a_bot.friends.createFriendStream({live: true, meta: true, hops: 1}),
    pull.drain(function (m) { b.push(m) })
  )

  pull(
    a_bot.friends.createFriendStream({live: true, meta: true, hops: 2}),
    pull.drain(function (m) { c.push(m) })
  )


  gen.initialize(a_bot, 100, 1, function (err, peers) {
    console.log(peers.map(function (e) { return e.id }))
    console.log(a)
    var seen = {}, count = 0
    a.forEach(function (v) {
      if(!seen[v.id]) {
        seen[v.id] = true
        count ++
      }
    })
    t.deepEqual(count, peers.length, 'all peers streamed')
    b.forEach(function (e) { t.ok(e.hops <= 1, 'b '+e.hops+' hops <= 1') })
    c.forEach(function (e) { t.ok(e.hops <= 2, 'c '+e.hops+' hops <= 2') })
    t.ok(a.length >= b.length, '1 hops')
    t.ok(c.length >= b.length, '2 hops')

    t.end()
    a_bot.close()
  })

})



