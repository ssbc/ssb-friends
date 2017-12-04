var pull = require('pull-stream')
var tape = require('tape')
var createSbot = require('scuttlebot')
  .use(require('scuttlebot/plugins/replicate'))
  .use(require('../'))

  var a_bot = createSbot({
    temp: 'alice',
    port: 45451, host: 'localhost', timeout: 20001,
    replicate: {hops: 2, legacy: false},
//    keys: alice
  })

tape('check that messages without a following or blocking key are ignored', function (t) {
  var changes = []

  pull(
    a_bot.friends.createFriendStream({live: true, meta: true, hops: 2}),
    pull.drain(function (m) { changes.push(m) })
  )

  var feedB = a_bot.createFeed()

  // feedA -> feedB
  a_bot.publish({
    type: 'contact',
    contact: feedB.id,
    following: true
  }, function () {
    t.deepEqual(changes, [
      { id: a_bot.id, hops: 0 },
      { id: feedB.id, hops: 1 }
    ])

    changes.length = 0

    a_bot.publish({
      type: 'contact',
      contact: feedB.id,
      sameAs: true
    }, function () {
      t.deepEqual(changes, [])

      a_bot.publish({
        type: 'contact',
        contact: feedB.id,
        blocking: true
      }, function () {
        t.deepEqual(changes, [
          { id: feedB.id, hops: -1 }
        ])
        t.end()
      })
    })
  })
})
