const tape = require('tape')
const run = require('promisify-tuple')
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
    run(alice.add)({
      type: 'contact',
      contact: bob.id,
      following: true
      // flagged: { reason: 'foo' }
    }),
    run(alice.add)(u.follow(carol.id)),
    run(bob.add)(u.follow(alice.id)),
    run(bob.add)({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }),
    run(carol.add)(u.follow(alice.id))
  ])

  // alice isFollowing bob, and NOT isBlocking bob
  const [err1, response1] = await run(ssbServer.friends.isFollowing)({
    source: alice.id,
    dest: bob.id,
  })
  t.error(err1)
  t.true(response1)
  const [err2, response2] = await run(ssbServer.friends.isBlocking)({
    source: alice.id,
    dest: bob.id,
  })
  t.error(err2)
  t.false(response2)

  // bob isBlocking carol, and NOT isFollowing carol
  const [err3, response3] = await run(ssbServer.friends.isBlocking)({
    source: bob.id,
    dest: carol.id,
  })
  t.error(err3)
  t.true(response3)
  const [err4, response4] = await run(ssbServer.friends.isFollowing)({
    source: bob.id,
    dest: carol.id,
  })
  t.error(err4)
  t.false(response4)

  const [err5, graph] = await run(ssbServer.friends.graph)()
  t.error(err5)
  t.deepEquals(graph, {
    [alice.id]: {
      [bob.id]: 1,
      [carol.id]: 1,
    },
    [bob.id]: {
      [alice.id]: 1,
      [carol.id]: -1,
    },
    [carol.id]: {
      [alice.id]: 1
    }
  })

  const [err6, hops] = await run(ssbServer.friends.hops)()
  t.error(err6)
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
          { id: carol.id, hops: 1 },
        ])
      )

      t.end()
    })
  )
})

tape('cleanup', (t) => {
  ssbServer.close(t.end)
})
