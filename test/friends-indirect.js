const tape = require('tape')
const ssbKeys = require('ssb-keys')
const run = require('promisify-tuple')
const pull = require('pull-stream')
const u = require('./util')

// create 3 feeds
// add some of friend edges (follow, flag)
// make sure the friends plugin analyzes correctly

function liveHops (ssbServer) {
  const live = {
    [ssbServer.id]: 0
  }
  pull(
    ssbServer.friends.hopStream({ live: true, old: true }),
    pull.drain((hops) => {
      for (const feedId of Object.keys(hops)) {
        live[feedId] = hops[feedId]
      }
    })
  )
  return live
}

const aliceKeys = ssbKeys.generate()
const ssbServer = u.Server({
  keys: aliceKeys,
  friends: {
    hops: 4
  }
})

const alice = ssbServer.createFeed(aliceKeys)
const bob = ssbServer.createFeed()
const carol = ssbServer.createFeed()
const dan = ssbServer.createFeed()

const live = liveHops(ssbServer)

tape('chain of friends', async (t) => {
  await Promise.all([
    run(alice.add)(u.follow(bob.id)),
    run(bob.add)(u.follow(carol.id)),
    run(carol.add)(u.follow(dan.id))
  ])

  const [err, all] = await run(ssbServer.friends.hops)()
  t.error(err)
  const expected = {
    [alice.id]: 0,
    [bob.id]: 1,
    [carol.id]: 2,
    [dan.id]: 3
  }

  t.deepEqual(all, expected)

  t.deepEqual(live, expected)

  t.end()
})

tape('hopStream live=false', (t) => {
  const expected = {
    [alice.id]: 0,
    [bob.id]: 1,
    [carol.id]: 2,
    [dan.id]: 3
  }

  pull(
    ssbServer.friends.hopStream({ live: false, old: true }),
    pull.collect((err, ary) => {
      if (err) throw err
      t.equals(ary.length, 1)
      t.deepEqual(ary[0], expected)
      t.end()
    })
  )
})

tape('cleanup', (t) => {
  ssbServer.close(t.end)
})
