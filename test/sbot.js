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
    a_bot.friends.createFriendStream({live: true, meta: true}),
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

  gen.initialize(a_bot, 10, 1, function (err, peers) {
    console.log(peers.map(function (e) { return e.id }))
    console.log(a)
    // t.deepEqual(a.length, peers.length) // is this test still important?
    b.forEach(function (e) { t.ok(e.hops <= 1, 'b '+e.hops+' hops <= 1') })
    c.forEach(function (e) { t.ok(e.hops <= 2, 'c '+e.hops+' hops <= 2') })
    t.ok(a.length >= b.length)
    t.ok(c.length >= b.length)

    t.end()
    a_bot.close()
  })

})
