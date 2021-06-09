const tape = require('tape')
const run = require('promisify-tuple')
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
    run(alice.add)({
      type: 'contact',
      contact: bob.id,
      following: true,
      flagged: true
    }),
    run(alice.add)(u.follow(carol.id)),
    run(bob.add)(u.follow(alice.id)),
    run(bob.add)({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: { reason: 'foo' }
    }),
    run(carol.add)(u.follow(alice.id)),
    run(alice.add)({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }),
    run(alice.add)({
      type: 'contact',
      contact: bob.id,
      following: true,
      flagged: false
    }),
    run(bob.add)(u.unfollow(carol.id))
  ])

  const [err, hops] = await run(ssbServer.friends.hops)()
  t.error(err)
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
