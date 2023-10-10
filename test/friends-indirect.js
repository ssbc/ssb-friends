const tape = require('tape')
const ssbKeys = require('ssb-keys')
const { promisify: p } = require('util')
const pull = require('pull-stream')
const u = require('./util')

// create 3 feeds
// add some of friend edges (follow, flag)
// make sure the friends plugin analyzes correctly

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
const dan = ssbServer.createFeed()

const live = liveFriends(ssbServer)

tape('chain of friends', async (t) => {
  await Promise.all([
    p(alice.add)(u.follow(bob.id)),
    p(bob.add)(u.follow(carol.id)),
    p(carol.add)(u.follow(dan.id))
  ])

  const all = await p(ssbServer.friends.hops)({ hops: 3 })
    .catch(t.error)
  const o = {}

  o[alice.id] = 0
  o[bob.id] = 1
  o[carol.id] = 2
  o[dan.id] = 3

  t.deepEqual(all, o)

  t.deepEqual(live, o)

  t.end()
})

const expected = [
  { id: alice.id, hops: 0 },
  { id: bob.id, hops: 1 },
  { id: carol.id, hops: 2 },
  { id: dan.id, hops: 3 }
]

tape('createFriendStream on long chain', (t) => {
  pull(
    ssbServer.friends.createFriendStream(),
    pull.collect((err, ary) => {
      if (err) throw err
      t.deepEqual(ary, expected.map((e) => e.id))
      t.end()
    })
  )
})

tape('creatFriendStream - meta', (t) => {
  pull(
    ssbServer.friends.createFriendStream({ meta: true }),
    pull.collect((err, ary) => {
      t.notOk(err)

      t.equal(ary.length, 4)
      t.deepEqual(sort(ary), sort(expected))

      t.end()
    })
  )
})

tape('cleanup', (t) => {
  ssbServer.close(t.end)
})
