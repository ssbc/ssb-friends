const tape = require('tape')
const pull = require('pull-stream')
const { promisify: p } = require('util')
const u = require('./util')

const botA = u.Server({
  replicate: {
    hops: 2,
    legacy: false
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
  await p(feedA.publish)({
    type: 'contact',
    contact: feedB.id,
    following: true
  })
  t.deepEqual(changes, [{ id: botA.id, hops: 0 }])
  changes.length = 0

  // feedB -> feedC
  await p(feedB.publish)({
    type: 'contact',
    contact: feedC.id,
    following: true
  })

  // follow feedA
  await p(botA.publish)({
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
  await p(botA.publish)({
    type: 'contact',
    contact: feedB.id,
    following: true
  })
  t.deepEqual(changes, [
    { id: feedB.id, hops: 1 },
    { id: feedC.id, hops: 2 }
  ])

  const g = await p(botA.friends.get)()
    .catch(t.error)
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
  }, 'botA: correct hops graph')

  const g2 = await p(botA.friends.get)({ source: botA.id })
    .catch(t.error)
  t.deepEqual(g2, {
    [feedA.id]: true,
    [feedB.id]: true
  }, 'botA: correct hops graph (from botA)')

  const g3 = await p(botA.friends.get)({ dest: feedB.id })
    .catch(t.error)
  t.deepEqual(g3, {
    [feedA.id]: true,
    [botA.id]: true
  }, 'botA: correct hops graph (to feedB)')

  const follows = await p(botA.friends.get)({ source: botA.id, dest: feedB.id })
    .catch(t.error)
  t.equal(follows, true)

  const follows5 = await p(botA.friends.get)({ source: botA.id, dest: feedC.id })
    .catch(t.error)
  t.notOk(follows5)

  t.end()
})

tape('legacy blocking / unblocking works', async (t) => {
  const feedD = botA.createFeed()
  const feedE = botA.createFeed()

  await p(feedD.publish)({
    type: 'contact',
    contact: feedE.id,
    following: true
  })

  const follows1 = await p(botA.friends.get)({
    source: feedD.id,
    dest: feedE.id
  })
    .catch(t.error)
  t.equal(follows1, true)

  await p(feedD.publish)({
    type: 'contact',
    contact: feedE.id,
    blocking: true
  })

  const follows2 = await p(botA.friends.get)({
    source: feedD.id,
    dest: feedE.id
  })
    .catch(t.error)
  t.notOk(follows2)

  await p(feedD.publish)({
    type: 'contact',
    contact: feedE.id,
    blocking: false
  })

  const follows3 = await p(botA.friends.get)({
    source: feedD.id,
    dest: feedE.id
  })
    .catch(t.error)
  // should not go back to following, after unblocking
  t.notOk(follows3)

  t.end()
})

tape('hops blocking / unblocking works', async (t) => {
  const feedF = botA.createFeed()

  await p(botA.publish)({
    type: 'contact',
    contact: feedF.id,
    blocking: true
  })

  const hops = await p(botA.friends.hops)()
    .catch(t.error)
  t.equal(hops[feedF.id], -1)

  await p(botA.publish)({
    type: 'contact',
    contact: feedF.id,
    blocking: false
  })

  const hops2 = await p(botA.friends.hops)()
    .catch(t.error)
  t.equal(hops2[feedF.id], -2)

  t.end()
})

tape('hops blocking / unblocking works', async (t) => {
  const feedH = botA.createFeed()
  const feedI = botA.createFeed()

  await p(botA.publish)({
    type: 'contact',
    contact: feedH.id,
    following: true
  })

  await p(feedH.publish)({
    type: 'contact',
    contact: feedI.id,
    following: true
  })

  const hops = await p(botA.friends.hops)()
    .catch(t.error)
  t.equal(hops[feedH.id], 1)
  t.equal(hops[feedI.id], 2)

  await p(botA.publish)({
    type: 'contact',
    contact: feedI.id,
    blocking: true
  })

  const hops2 = await p(botA.friends.hops)()
    .catch(t.error)
  t.equal(hops2[feedH.id], 1)
  t.equal(hops2[feedI.id], -1)

  await p(botA.publish)({
    type: 'contact',
    contact: feedI.id,
    blocking: false
  })

  const hops3 = await p(botA.friends.hops)()
    .catch(t.error)
  t.equal(hops3[feedH.id], 1)
  t.equal(hops3[feedI.id], 2)

  t.end()
})

tape('finish tests', (t) => {
  botA.close(t.end)
})
