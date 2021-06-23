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
    ssbServer.friends.graphStream({ live: true, old: false }),
    pull.drain((graph) => {
      for (const source of Object.keys(graph)) {
        if (source === ssbServer.id) {
          for (const dest of Object.keys(graph[source])) {
            live[dest] = graph[source][dest]
          }
        }
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
    // Publish a few irrelevant messages to test `./contacts.js` corner cases
    run(alice.add)({ type: 'post', text: 'hello world' }),
    run(alice.add)({ type: 'contact', contact: 'not a feed id' }),
    // Publish actual contact messages
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

  const [err2, graph] = await run(ssbServer.friends.graph)()
  t.error(err2)

  t.deepEquals(graph, {
    [alice.id]: {
      [bob.id]: 1,
      [carol.id]: -1
    },
    [bob.id]: {
      [alice.id]: 1,
      [carol.id]: -2
    },
    [carol.id]: {
      [alice.id]: 1
    }
  })

  t.end()
})

tape('cleanup', (t) => {
  ssbServer.close(t.end)
})
