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

  var hops = {}

  //currently, the legacy api has a thing were it sends `{id: sbot.id, hops: 0}` twice,
  //just gonna make the test more forgiving for now.
  pull(
    a_bot.friends.createFriendStream({live: true, meta: true, hops: 2}),
    pull.drain(function (m) {
      if(hops[m.id] != m.hops)
        changes.push(m)
      hops[m.id] = m.hops
    })
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

          a_bot.friends.get(function (err, g) {
            var G = {}
            G[feedA.id] = {}
            G[feedA.id][feedB.id] = true
            G[feedB.id] = {}
            G[feedB.id][feedC.id] = true
            G[a_bot.id] = {}
            G[a_bot.id][feedA.id] = true
            G[a_bot.id][feedB.id] = true
            t.deepEqual(g, G)

            a_bot.friends.get({source: a_bot.id}, function (err, g) {
              t.deepEqual(g, G[a_bot.id])

              a_bot.friends.get({dest: feedB.id}, function (err, g) {
                var _c = {}
                _c[feedA.id] = true
                _c[a_bot.id] = true

                t.deepEqual(g, _c)
                a_bot.friends.get({source: a_bot.id, dest: feedB.id}, function (err, follows) {
                  t.equal(follows, true)
                  a_bot.friends.get({source: a_bot.id, dest: feedC.id}, function (err, follows) {
                    t.equal(follows, null)
                    a_bot.close()
                    t.end()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})

