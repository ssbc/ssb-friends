const tape = require('tape')
const { promisify: p } = require('util')
const ssbKeys = require('ssb-keys')
const pull = require('pull-stream')
const u = require('./util')

// create 3 feeds
// add some of friend edges (follow, flag)
// make sure the friends plugin analyzes correctly

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

const live = liveFriends(ssbServer)

tape('add and delete', async (t) => {
  await Promise.all([
    p(alice.add)({
      type: 'contact',
      contact: bob.id,
      following: true,
      flagged: true
    }),
    p(alice.add)(u.follow(carol.id)),
    p(bob.add)(u.follow(alice.id)),
    p(bob.add)({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: { reason: 'foo' }
    }),
    p(carol.add)(u.follow(alice.id)),
    p(alice.add)({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }),
    p(alice.add)({
      type: 'contact',
      contact: bob.id,
      following: true,
      flagged: false
    }),
    p(bob.add)(u.unfollow(carol.id))
  ])

  const hops = await p(ssbServer.friends.hops)()
    .catch(t.error)
  t.deepEqual(live, hops)
  t.end()
})

tape('createFriendStream after delete', (t) => {
  pull(
    ssbServer.friends.createFriendStream(),
    pull.collect((err, ary) => {
      t.notOk(err)
      t.equal(ary.length, 2)
      t.deepEqual(ary.sort(), [alice.id, bob.id].sort())
      t.end()
    })
  )
})

tape('cleanup', (t) => {
  ssbServer.close(t.end)
})
