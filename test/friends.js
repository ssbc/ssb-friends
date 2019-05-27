var ssbKeys = require('ssb-keys')
var cont    = require('cont')
var tape    = require('tape')
var u       = require('./util')
var pull    = require('pull-stream')
var crypto  = require('crypto')

var createSsbServer = require('secret-stack')({
    caps: {shs: crypto.randomBytes(32).toString('base64')}
  })
  .use(require('ssb-db'))
  .use(require('ssb-replicate'))
  .use(require('..'))

function sort (ary) {
  return ary.sort(function (a, b) {
    return a.id < b.id ? -1 : a.id === b.id ? 1 : 0
  })
}

function liveFriends(ssbServer) {
  var live = {}
  pull(
    ssbServer.friends.createFriendStream({live: true, meta: true}),
    pull.drain(function (friend) {
      if(friend.sync) return
      live[friend.id] = friend.hops
    })
  )
  return live
}

  var aliceKeys = ssbKeys.generate()

  var ssbServer = createSsbServer({
      temp:'test-friends1',
      port: 45451, host: 'localhost', timeout: 1000,
      keys: aliceKeys
    })

  var alice = ssbServer.createFeed(aliceKeys)
  var bob = ssbServer.createFeed()
  var carol = ssbServer.createFeed()

  tape('add friends, and retrive all friends for a peer', function (t) {
    var live = liveFriends(ssbServer)

    cont.para([
      alice.add({
        type: 'contact', contact: bob.id,
        following: true,
//        flagged: { reason: 'foo' }
      }),
      alice.add(u.follow(carol.id)),
      bob.add(u.follow(alice.id)),
      bob.add({
        type: 'contact', contact: carol.id,
        following: false, flagged: true
      }),
      carol.add(u.follow(alice.id))
    ]) (function (err, results) {
      if(err) throw err
      ssbServer.friends.hops(function (err, hops) {
        if(err) throw err
        t.deepEqual(live, hops)
        t.end()
      })
    })
  })

  tape('createFriendStream', function (t) {
    pull(
      ssbServer.friends.createFriendStream(),
      pull.collect(function (err, ary) {
        t.notOk(err)
        t.equal(ary.length, 3)
        t.deepEqual(ary.sort(), [alice.id, bob.id, carol.id].sort())
        t.end()
      })
    )
  })

  tape('createFriendStream - meta', function (t) {
    pull(
      ssbServer.friends.createFriendStream({meta: true}),
      pull.collect(function (err, ary) {
        t.notOk(err)
        t.equal(ary.length, 3)
        t.deepEqual(sort(ary), sort([
          {id: alice.id, hops: 0},
          {id: bob.id, hops: 1},
          {id: carol.id, hops: 1}
        ]))

        t.end()
      })
    )
  })

  tape('cleanup', function (t) {
    ssbServer.close()
    t.end()
  })






