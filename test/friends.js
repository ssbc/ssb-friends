const tape = require('tape')
const { promisify: p } = require('util')
const ssbKeys = require('ssb-keys')
const pull = require('pull-stream')
const u = require('./util')

function sort (ary) {
  return ary.sort((a, b) => (a.id < b.id ? -1 : a.id === b.id ? 1 : 0))
}

function liveFriends (ssbServer) {
  const live = {}
  pull(
    ssbServer.friends.createFriendStream({ live: true, meta: true }),
    pull.drain((friend) => {
      if (friend.sync) return
      live[friend.id] = friend.hops
    })
  )
  return live
}

const aliceKeys = ssbKeys.generate()

const ssbServer = u.Server({
  keys: aliceKeys
})

const alice = ssbServer.createFeed(aliceKeys)
const bob = ssbServer.createFeed()
const carol = ssbServer.createFeed()

tape('add friends, and retrieve all friends for a peer', async (t) => {
  const live = liveFriends(ssbServer)

  await Promise.all([
    p(alice.add)({
      type: 'contact',
      contact: bob.id,
      following: true
      // flagged: { reason: 'foo' }
    }),
    p(alice.add)(u.follow(carol.id)),
    p(bob.add)(u.follow(alice.id)),
    p(bob.add)({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }),
    p(carol.add)(u.follow(alice.id))
  ])

  const hops = await p(ssbServer.friends.hops)()
    .catch(t.error)
  t.deepEqual(live, hops)
  t.end()
})

tape('createFriendStream', (t) => {
  pull(
    ssbServer.friends.createFriendStream(),
    pull.collect((err, ary) => {
      t.notOk(err)
      t.equal(ary.length, 3)
      t.deepEqual(ary.sort(), [alice.id, bob.id, carol.id].sort())
      t.end()
    })
  )
})

tape('createFriendStream - meta', (t) => {
  pull(
    ssbServer.friends.createFriendStream({ meta: true }),
    pull.collect((err, ary) => {
      t.notOk(err)
      t.equal(ary.length, 3)
      t.deepEqual(
        sort(ary),
        sort([
          { id: alice.id, hops: 0 },
          { id: bob.id, hops: 1 },
          { id: carol.id, hops: 1 }
        ])
      )

      t.end()
    })
  )
})

tape('cleanup', (t) => {
  ssbServer.close(t.end)
})
