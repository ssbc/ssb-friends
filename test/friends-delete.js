const tape = require('tape')
const run = require('promisify-tuple')
const ssbKeys = require('ssb-keys')
const pull = require('pull-stream')
const u = require('./util')

// create 3 feeds
// add some of friend edges (follow, flag)
// make sure the friends plugin analyzes correctly

function liveFriends (ssbServer) {
  const live = {
    [ssbServer.id]: 0
  }
  pull(
    ssbServer.friends.graphStream(),
    pull.drain((edge) => {
      if (edge.source === ssbServer.id) {
        live[edge.dest] = edge.value
      }
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

  const graph = await new Promise((resolve, reject) => {
    try {
      pull(
        ssbServer.friends.graphStream({ live: false }),
        pull.collect((err, ary) => {
          if (err) reject(err)
          else resolve(ary)
        })
      )
    } catch (err) {
      reject(err)
    }
  })
  t.equals(graph.length, 1)
  t.deepEquals(graph[0], {
    [alice.id]: {
      [bob.id]: 1,
      [carol.id]: -1,
    },
    [bob.id]: {
      [alice.id]: 1,
      [carol.id]: -2,
    },
    [carol.id]: {
      [alice.id]: 1,
    }
  })

  t.end()
})

tape('cleanup', (t) => {
  ssbServer.close(t.end)
})
