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
  var a = []
  pull(
    a_bot.friends.createFriendStream({live: true, meta: true}),
    pull.drain(function (m) { a.push(m) })
  )


  gen.initialize(a_bot, 10, 1, function (err, peers) {
    console.log(peers.map(function (e) { return e.id }))
    console.log(a)
    t.deepEqual(a.length, peers.length)
    t.end()
    a_bot.close()
  })

})



