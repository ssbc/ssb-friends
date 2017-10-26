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

  var followFeed = a_bot.createFeed()
  var foafFeed = a_bot.createFeed()

  followFeed.publish({
    type: 'contact',
    contact: foafFeed.id,
    following: true
  }, function () {
    t.deepEqual(changes, [
      { id: a_bot.id, hops: 0 }
    ])

    a_bot.publish({
      type: 'contact',
      contact: followFeed.id,
      following: true
    }, function () {
      t.deepEqual(changes, [
        { id: a_bot.id, hops: 0 },
        { id: followFeed.id, hops: 1 },
        { id: foafFeed.id, hops: 2 }
      ])
      a_bot.close()
      t.end()
    })
  })
})
