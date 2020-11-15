const pull = require('pull-stream')
const tape = require('tape')
const series = require('run-series')
const crypto = require('crypto')

const createSbot = require('secret-stack')({
  caps: { shs: crypto.randomBytes(32).toString('base64') }
})
  .use(require('ssb-db'))
  .use(require('ssb-replicate'))
  .use(require('..'))

const botA = createSbot({
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
  const changes = []
  const hops = {}

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

  const feedA = botA.createFeed()
  const feedB = botA.createFeed()
  const feedC = botA.createFeed()

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

      const G = {}

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

        const _c = {}
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
        t.notOk(follows)
        cb()
      })
    }
  ], t.end)
})

tape('legacy blocking / unblocking works', function (t) {
  const feedD = botA.createFeed()
  const feedE = botA.createFeed()

  series([
    cb => {
      feedD.publish({
        type: 'contact',
        contact: feedE.id,
        following: true
      }, cb)
    },
    cb => {
      botA.friends.get({
        source: feedD.id,
        dest: feedE.id
      }, function (err, follows) {
        t.error(err)
        t.equal(follows, true)
        cb()
      })
    },
    cb => {
      feedD.publish({
        type: 'contact',
        contact: feedE.id,
        blocking: true
      }, cb)
    },
    cb => {
      botA.friends.get({
        source: feedD.id,
        dest: feedE.id
      }, function (err, follows) {
        t.error(err)
        t.notOk(follows)
        cb()
      })
    },
    cb => {
      feedD.publish({
        type: 'contact',
        contact: feedE.id,
        blocking: false
      }, cb)
    },
    cb => {
      botA.friends.get({
        source: feedD.id,
        dest: feedE.id
      }, function (err, follows) {
        t.error(err)
        // should not go back to following, after unblocking
        t.notOk(follows)
        cb()
      })
    }
  ], t.end)
})

tape('hops blocking / unblocking works', function (t) {
  const feedF = botA.createFeed()
  series([
    cb => {
      botA.publish({
        type: 'contact',
        contact: feedF.id,
        blocking: true
      }, cb)
    },
    cb => {
      botA.friends.hops(function (err, hops) {
        t.error(err)
        t.equal(hops[feedF.id], -1)
        cb()
      })
    },
    cb => {
      botA.publish({
        type: 'contact',
        contact: feedF.id,
        blocking: false
      }, cb)
    },
    cb => {
      botA.friends.hops(function (err, hops) {
        t.error(err)
        t.equal(hops[feedF.id], -2)
        cb()
      })
    }
  ], t.end)
})

tape('hops blocking / unblocking works', function (t) {
  const feedH = botA.createFeed()
  const feedI = botA.createFeed()
  series([
    cb => {
      botA.publish({
        type: 'contact',
        contact: feedH.id,
        following: true
      }, cb)
    },
    cb => {
      feedH.publish({
        type: 'contact',
        contact: feedI.id,
        following: true
      }, cb)
    },
    cb => {
      botA.friends.hops(function (err, hops) {
        t.error(err)
        t.equal(hops[feedH.id], 1)
        t.equal(hops[feedI.id], 2)
        cb()
      })
    },
    cb => {
      botA.publish({
        type: 'contact',
        contact: feedI.id,
        blocking: true
      }, cb)
    },
    cb => {
      botA.friends.hops(function (err, hops) {
        t.error(err)
        t.equal(hops[feedH.id], 1)
        t.equal(hops[feedI.id], -1)
        cb()
      })
    },
    // after unblocking, goes back to 2,
    // because H follows.
    cb => {
      botA.publish({
        type: 'contact',
        contact: feedI.id,
        blocking: false
      }, cb)
    },
    cb => {
      botA.friends.hops(function (err, hops) {
        t.error(err)
        t.equal(hops[feedH.id], 1)
        t.equal(hops[feedI.id], 2)
        cb()
      })
    }
  ], t.end)
})

tape('finish tests', function (t) {
  botA.close()
  t.end()
})
