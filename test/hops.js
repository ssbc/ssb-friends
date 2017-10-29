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

tape('check that friends are re-emitted when distance changes when `hops: 2`', function (t) {

  var changes = []

  pull(
    a_bot.friends.createFriendStream({live: true, meta: true, hops: 2}),
    pull.drain(function (m) { changes.push(m) })
  )

  var feedA = a_bot.createFeed()
  var feedB = a_bot.createFeed()
  var feedC = a_bot.createFeed()

  // feedA -> feedB
  feedA.publish({
    type: 'contact',
    contact: feedB.id,
    following: true
  }, function () {
    t.deepEqual(changes, [
      { id: a_bot.id, hops: 0 }
    ])

    changes.length = 0

    // feedB -> feedC
    feedB.publish({
      type: 'contact',
      contact: feedC.id,
      following: true
    }, function () {
      // follow feedA
      a_bot.publish({
        type: 'contact',
        contact: feedA.id,
        following: true
      }, function () {
        t.deepEqual(changes, [
          { id: feedA.id, hops: 1 },
          { id: feedB.id, hops: 2 }
        ])

        changes.length = 0

        // follow feedB
        a_bot.publish({
          type: 'contact',
          contact: feedB.id,
          following: true
        }, function () {
          t.deepEqual(changes, [
            { id: feedB.id, hops: 1 },
            { id: feedC.id, hops: 2 }
          ])

          a_bot.close()
          t.end()
        })
      })
    })
  })
})
