const tape = require('tape')
const cont = require('cont')
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

tape('add and delete', (t) => {
  cont.para([
    alice.add({
      type: 'contact',
      contact: bob.id,
      following: true,
      flagged: true
    }),
    alice.add(u.follow(carol.id)),
    bob.add(u.follow(alice.id)),
    bob.add({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: { reason: 'foo' }
    }),
    carol.add(u.follow(alice.id)),
    alice.add({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }),
    alice.add({
      type: 'contact',
      contact: bob.id,
      following: true,
      flagged: false
    }),
    bob.add(u.unfollow(carol.id))
  ])(() => {
    ssbServer.friends.hops((err, hops) => {
      if (err) throw err
      t.deepEqual(live, hops)
      t.end()
    })
  })
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
  ssbServer.close()
  t.end()
})
