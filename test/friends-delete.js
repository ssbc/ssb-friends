var ssbKeys = require('ssb-keys')
var cont    = require('cont')
var tape    = require('tape')
var u       = require('./util')
var pull    = require('pull-stream')
var crypto  = require('crypto')

// create 3 feeds
// add some of friend edges (follow, flag)
// make sure the friends plugin analyzes correctly

var createSsbServer = require('secret-stack')({
    caps: {shs: crypto.randomBytes(32).toString('base64')}
  })
  .use(require('ssb-db'))
  .use(require('ssb-replicate'))
  .use(require('..'))

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
      temp:'test-friends2',
      port: 45452, host: 'localhost', timeout: 1000,
      keys: aliceKeys
    })

  var alice = ssbServer.createFeed(aliceKeys)
  var bob   = ssbServer.createFeed()
  var carol = ssbServer.createFeed()

  var live = liveFriends(ssbServer)

  tape('add and delete', function (t) {

    cont.para([
      alice.add({
        type:'contact', contact:bob.id,
        following: true, flagged: true
      }),
      alice.add(u.follow(carol.id)),
      bob.add(u.follow(alice.id)),
      bob.add({
        type: 'contact', contact: carol.id,
        following: false, flagged: { reason: 'foo' }
      }),
      carol.add(u.follow(alice.id)),
      alice.add({
        type:'contact', contact: carol.id,
        following: false,  flagged: true
      }),
      alice.add({
        type:'contact', contact: bob.id,
        following: true,  flagged: false
      }),
      bob.add(u.unfollow(carol.id))
    ]) (function () {
      ssbServer.friends.hops(function (err, hops) {
        if(err) throw err
        t.deepEqual(live, hops)
        t.end()
      })
    })
  })

  tape('createFriendStream after delete', function (t) {
    pull(
      ssbServer.friends.createFriendStream(),
      pull.collect(function (err, ary) {
        t.notOk(err)
        t.equal(ary.length, 2)
        t.deepEqual(ary.sort(), [alice.id, bob.id].sort())
        t.end()
      })
    )
  })

  tape('cleanup', function (t) {
    ssbServer.close()

    t.end()
  })




























