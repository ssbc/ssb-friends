const tape = require('tape')
const cont = require('cont')
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

tape('add friends, and retrive all friends for a peer', (t) => {
  const live = liveFriends(ssbServer)

  cont.para([
    alice.add({
      type: 'contact',
      contact: bob.id,
      following: true
      //        flagged: { reason: 'foo' }
    }),
    alice.add(u.follow(carol.id)),
    bob.add(u.follow(alice.id)),
    bob.add({
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }),
    carol.add(u.follow(alice.id))
  ])((err, results) => {
    if (err) throw err
    ssbServer.friends.hops((err, hops) => {
      if (err) throw err
      t.deepEqual(live, hops)
      t.end()
    })
  })
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
  ssbServer.close()
  t.end()
})
