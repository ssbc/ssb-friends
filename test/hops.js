var pull = require('pull-stream')
var tape = require('tape')
var series = require('run-series')
var createSbot = require('scuttlebot')
  .use(require('scuttlebot/plugins/replicate'))
  .use(require('../'))

var botA = createSbot({
  temp: 'alice',
  port: 45451,
  host: 'localhost',
  timeout: 20001,
  replicate: {
    hops: 2,
    legacy: false
  }
})

tape('check that friends are re-emitted when distance changes when `hops: 2`', function (t) {
  var changes = []
  var hops = {}

  // currently, the legacy api has a thing were it sends `{id: sbot.id, hops: 0}` twice,
  // just gonna make the test more forgiving for now.
  pull(
    botA.friends.createFriendStream({
      live: true,
      meta: true,
      hops: 2
    }),
    pull.drain(function (m) {
      if (hops[m.id] !== m.hops) {
        changes.push(m)
      }
      hops[m.id] = m.hops
    })
  )

  var feedA = botA.createFeed()
  var feedB = botA.createFeed()
  var feedC = botA.createFeed()

  series([
    // feedA -> feedB
    cb => {
      feedA.publish({
        type: 'contact',
        contact: feedB.id,
        following: true
      }, cb)
    },
    cb => {
      t.deepEqual(changes, [
        { id: botA.id, hops: 0 }
      ])

      changes.length = 0

      // feedB -> feedC
      feedB.publish({
        type: 'contact',
        contact: feedC.id,
        following: true
      }, cb)
    },
    cb => {
      // follow feedA
      botA.publish({
        type: 'contact',
        contact: feedA.id,
        following: true
      }, cb)
    },
    cb => {
      t.deepEqual(changes, [
        { id: feedA.id, hops: 1 },
        { id: feedB.id, hops: 2 }
      ])

      changes.length = 0

      // follow feedB
      botA.publish({
        type: 'contact',
        contact: feedB.id,
        following: true
      }, cb)
    },
    cb => {
      t.deepEqual(changes, [
        { id: feedB.id, hops: 1 },
        { id: feedC.id, hops: 2 }
      ])

      var G = {}

      series([
        cb => {
          botA.friends.get(function (err, g) {
            t.error(err)

            G[feedA.id] = {}
            G[feedA.id][feedB.id] = true
            G[feedB.id] = {}
            G[feedB.id][feedC.id] = true
            G[botA.id] = {}
            G[botA.id][feedA.id] = true
            G[botA.id][feedB.id] = true
            t.deepEqual(g, G)

            cb()
          })
        },
        cb => {
          botA.friends.get({
            source: botA.id
          }, function (err, g) {
            t.error(err)
            t.deepEqual(g, G[botA.id])
            cb()
          })
        }
      ], cb)
    },
    cb => {
      botA.friends.get({
        dest: feedB.id
      }, function (err, g) {
        t.error(err)

        var _c = {}
        _c[feedA.id] = true
        _c[botA.id] = true

        t.deepEqual(g, _c)

        cb()
      })
    },
    cb => {
      botA.friends.get({
        source: botA.id,
        dest: feedB.id
      }, function (err, follows) {
        t.error(err)
        t.equal(follows, true)
        cb()
      })
    },
    cb => {
      botA.friends.get({
        source: botA.id,
        dest: feedC.id
      }, function (err, follows) {
        t.error(err)
        t.equal(follows, null)
        cb()
      })
    }
  ], t.end)
})

tape('legacy blocking / unblocking works', function (t) {
  var feedA = botA.createFeed()
  var feedB = botA.createFeed()

  series([
    cb => {
      feedA.publish({
        type: 'contact',
        contact: feedB.id,
        following: true
      }, cb)
    },
    cb => {
      botA.friends.get({
        source: feedA.id,
        dest: feedB.id
      }, function (err, follows) {
        t.error(err)
        t.equal(follows, true)
        cb()
      })
    },
    cb => {
      feedA.publish({
        type: 'contact',
        contact: feedB.id,
        blocking: true
      }, cb)
    },
    cb => {
      botA.friends.get({
        source: feedA.id,
        dest: feedB.id
      }, function (err, follows) {
        t.error(err)
        t.equal(follows, false)
        cb()
      })
    },
    cb => {
      feedA.publish({
        type: 'contact',
        contact: feedB.id,
        blocking: false
      }, cb)
    },
    cb => {
      botA.friends.get({
        source: feedA.id,
        dest: feedB.id
      }, function (err, follows) {
        t.error(err)
        t.equal(follows, true)
        cb()
      })
    }
  ], t.end)
})

tape('hops blocking / unblocking works', function (t) {
  var feedA = botA.createFeed()

  series([
    cb => {
      botA.publish({
        type: 'contact',
        contact: feedA.id,
        blocking: true
      }, cb)
    },
    cb => {
      botA.friends.hops(function (err, hops) {
        t.error(err)
        t.equal(hops[feedA.id], -1)
        cb()
      })
    },
    cb => {
      botA.publish({
        type: 'contact',
        contact: feedA.id,
        blocking: false
      }, cb)
    },
    cb => {
      botA.friends.hops(function (err, hops) {
        t.error(err)
        t.equal(hops[feedA.id], 2)
        cb()
      })
    }
  ], t.end)
})

tape('finish tests', function (t) {
  botA.close()
  t.end()
})
