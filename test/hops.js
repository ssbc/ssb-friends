const tape = require('tape')
const pull = require('pull-stream')
const run = require('promisify-tuple')
const u = require('./util')

const botA = u.Server({
  friends: {
    hops: 2,
  }
})

tape('friends are re-emitted when distance changes `hops: 2`', async (t) => {
  const changes = []
  const hops = {}

  // currently, the legacy api has a thing were it sends `{id: sbot.id, hops: 0}` twice,
  // just gonna make the test more forgiving for now.
  pull(
    botA.friends.createFriendStream({
      live: true,
      meta: true,
      hops: 2
    }),
    pull.drain((m) => {
      if (hops[m.id] !== m.hops) {
        changes.push(m)
      }
      hops[m.id] = m.hops
    })
  )

  const feedA = botA.createFeed()
  const feedB = botA.createFeed()
  const feedC = botA.createFeed()

  // feedA -> feedB
  await run(feedA.publish)({
    type: 'contact',
    contact: feedB.id,
    following: true
  })
  t.deepEqual(changes, [ { id: botA.id, hops: 0 } ])
  changes.length = 0

  // feedB -> feedC
  await run(feedB.publish)({
    type: 'contact',
    contact: feedC.id,
    following: true
  })

  // follow feedA
  await run(botA.publish)({
    type: 'contact',
    contact: feedA.id,
    following: true
  })
  t.deepEqual(changes, [
    { id: feedA.id, hops: 1 },
    { id: feedB.id, hops: 2 }
  ])
  changes.length = 0

  // follow feedB
  await run(botA.publish)({
    type: 'contact',
    contact: feedB.id,
    following: true
  })
  t.deepEqual(changes, [
    { id: feedB.id, hops: 1 },
    { id: feedC.id, hops: 2 }
  ])

  const [err, g] = await run(botA.friends.get)()
  t.error(err)
  t.deepEqual(g, {
    [feedA.id]: {
      [feedB.id]: true
    },
    [feedB.id]: {
      [feedC.id]: true
    },
    [botA.id]: {
      [feedA.id]: true,
      [feedB.id]: true
    }
  })

  const [err2, g2] = await run(botA.friends.get)({ source: botA.id })
  t.error(err2)
  t.deepEqual(g2, {
    [feedA.id]: true,
    [feedB.id]: true
  })

  const [err3, g3] = await run(botA.friends.get)({ dest: feedB.id })
  t.error(err3)
  t.deepEqual(g3, {
    [feedA.id]: true,
    [botA.id]: true
  })

  const [err4, follows] = await run(botA.friends.get)({ source: botA.id, dest: feedB.id })
  t.error(err4)
  t.equal(follows, true)

  const [err5, follows5] = await run(botA.friends.get)({ source: botA.id, dest: feedC.id })
  t.error(err5)
  t.notOk(follows5)

  t.end()
})

tape('legacy blocking / unblocking works', async (t) => {
  const feedD = botA.createFeed()
  const feedE = botA.createFeed()

  await run(feedD.publish)({
    type: 'contact',
    contact: feedE.id,
    following: true
  })

  const [err1, follows1] = await run(botA.friends.get)({
    source: feedD.id,
    dest: feedE.id
  })
  t.error(err1)
  t.equal(follows1, true)

  await run(feedD.publish)({
    type: 'contact',
    contact: feedE.id,
    blocking: true
  })

  const [err2, follows2] = await run(botA.friends.get)({
    source: feedD.id,
    dest: feedE.id
  })
  t.error(err2)
  t.notOk(follows2)

  await run(feedD.publish)({
    type: 'contact',
    contact: feedE.id,
    blocking: false
  })

  const [err3, follows3] = await run(botA.friends.get)({
    source: feedD.id,
    dest: feedE.id
  })
  t.error(err3)
  // should not go back to following, after unblocking
  t.notOk(follows3)

  t.end()
})

tape('hops blocking / unblocking works', async (t) => {
  const feedF = botA.createFeed()

  await run(botA.publish)({
    type: 'contact',
    contact: feedF.id,
    blocking: true
  })

  const [err, hops] = await run(botA.friends.hops)()
  t.error(err)
  t.equal(hops[feedF.id], -1)

  await run(botA.publish)({
    type: 'contact',
    contact: feedF.id,
    blocking: false
  })

  const [err2, hops2] = await run(botA.friends.hops)()
  t.error(err2)
  t.equal(hops2[feedF.id], -2)

  t.end()
})

tape('hops blocking / unblocking works', async (t) => {
  const feedH = botA.createFeed()
  const feedI = botA.createFeed()

  await run(botA.publish)({
    type: 'contact',
    contact: feedH.id,
    following: true
  })

  await run(feedH.publish)({
    type: 'contact',
    contact: feedI.id,
    following: true
  })

  const [err, hops] = await run(botA.friends.hops)()
  t.error(err)
  t.equal(hops[feedH.id], 1)
  t.equal(hops[feedI.id], 2)

  await run(botA.publish)({
    type: 'contact',
    contact: feedI.id,
    blocking: true
  })

  const [err2, hops2] = await run(botA.friends.hops)()
  t.error(err2)
  t.equal(hops2[feedH.id], 1)
  t.equal(hops2[feedI.id], -1)

  await run(botA.publish)({
    type: 'contact',
    contact: feedI.id,
    blocking: false
  })

  const [err3, hops3] = await run(botA.friends.hops)()
  t.error(err3)
  t.equal(hops3[feedH.id], 1)
  t.equal(hops3[feedI.id], 2)

  t.end()
})

tape('finish tests', (t) => {
  botA.close(t.end)
})
