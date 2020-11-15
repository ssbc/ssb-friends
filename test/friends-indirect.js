const ssbKeys = require('ssb-keys')
const cont = require('cont')
const tape = require('tape')
const u = require('./util')
const pull = require('pull-stream')

// create 3 feeds
// add some of friend edges (follow, flag)
// make sure the friends plugin analyzes correctly

function sort (ary) {
  return ary.sort(function (a, b) {
    return a.id < b.id ? -1 : a.id === b.id ? 1 : 0
  })
}

function liveFriends (ssbServer) {
  const live = {}
  pull(
    ssbServer.friends.createFriendStream({ live: true, meta: true }),
    pull.drain(function (friend) {
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

tape('chain of friends', function (t) {
  cont.para([
    alice.add(u.follow(bob.id)),
    bob.add(u.follow(carol.id)),
    carol.add(u.follow(dan.id))
  ])(function (err, results) {
    if (err) throw err

    ssbServer.friends.hops({ hops: 3 }, function (err, all) {
      if (err) throw err
      const o = {}

      o[alice.id] = 0
      o[bob.id] = 1
      o[carol.id] = 2
      o[dan.id] = 3

      t.deepEqual(all, o)

      t.deepEqual(live, o)

      t.end()
    })
  })
})

const expected = [
  { id: alice.id, hops: 0 },
  { id: bob.id, hops: 1 },
  { id: carol.id, hops: 2 },
  { id: dan.id, hops: 3 }
]

tape('createFriendStream on long chain', function (t) {
  pull(
    ssbServer.friends.createFriendStream(),
    pull.collect(function (err, ary) {
      if (err) throw err
      t.deepEqual(ary, expected.map(function (e) { return e.id }))
      t.end()
    })
  )
})

tape('creatFriendStream - meta', function (t) {
  pull(
    ssbServer.friends.createFriendStream({ meta: true }),
    pull.collect(function (err, ary) {
      t.notOk(err)

      t.equal(ary.length, 4)
      t.deepEqual(sort(ary), sort(expected))

      t.end()
    })
  )
})

tape('cleanup', function (t) {
  ssbServer.close()
  t.end()
})
