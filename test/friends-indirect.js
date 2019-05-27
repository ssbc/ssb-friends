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
      temp:'test-friends3',
      port: 45453, host: 'localhost', timeout: 1000,
      keys: aliceKeys
    })

  var alice = ssbServer.createFeed(aliceKeys)
  var bob   = ssbServer.createFeed()
  var carol = ssbServer.createFeed()
  var dan   = ssbServer.createFeed()

  var live = liveFriends(ssbServer)

  tape('chain of friends', function (t) {
    cont.para([
      alice.add(u.follow(bob.id)),
      bob.add(u.follow(carol.id)),
      carol.add(u.follow(dan.id))
    ]) (function (err, results) {
      if(err) throw err

      ssbServer.friends.hops({hops: 3}, function (err, all) {
        if(err) throw err
        var o = {}

        o[alice.id] = 0
        o[bob.id]   = 1
        o[carol.id] = 2
        o[dan.id]   = 3

        t.deepEqual(all, o)

        t.deepEqual(live, o)

        t.end()
      })
    })
  })

  var expected = [
    {id: alice.id, hops: 0},
    {id: bob.id, hops: 1},
    {id: carol.id, hops: 2},
    {id: dan.id, hops: 3}
  ]

  tape('createFriendStream on long chain', function (t) {

    pull(
      ssbServer.friends.createFriendStream(),
      pull.collect(function (err, ary) {
        if(err) throw err
        t.deepEqual(ary, expected.map(function (e) { return e.id }))
        t.end()
      })
    )

  })

  tape('creatFriendStream - meta', function (t) {

    pull(
      ssbServer.friends.createFriendStream({meta: true}),
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































