const tape = require('tape')
const os = require('os')
const path = require('path')
const ssbKeys = require('ssb-keys')
const run = require('promisify-tuple')
const pull = require('pull-stream')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const u = require('./util')

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

const dir = path.join(os.tmpdir(), 'friends-db2')

rimraf.sync(dir)
mkdirp.sync(dir)

function Server (opts = {}) {
  const stack = SecretStack({ caps })
    .use(require('ssb-db2'))
    .use(require('..'))

  return stack(opts)
}

tape('db2 friends test', async (t) => {
  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()
  const david = ssbKeys.generate()

  let sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false
    },
    path: dir
  })
  let live = liveHops(sbot)

  await Promise.all([
    // Publish some irrelevant messages to test that the db2 index doesn't crash
    run(sbot.db.create)({keys: alice, content: { type: 'post', text: 'hello world' }}),
    run(sbot.db.create)({keys: alice, content: { type: 'contact', contact: 'not a feed' }}),
    // Publish actual follows
    run(sbot.db.create)({keys: alice, content: u.follow(bob.id)}),
    run(sbot.db.create)({keys: alice, content: u.follow(carol.id)}),
    run(sbot.db.create)({keys: alice, content: u.follow(alice.id)}),
    run(sbot.db.create)({keys: bob, content: u.follow(alice.id)}),
    run(sbot.db.create)({keys: bob, content: {
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }}),
    run(sbot.db.create)({keys: bob, content: u.block(david.id)}),
    run(sbot.db.create)({keys: carol, content: u.follow(alice.id)}),
  ])

  const [err, hops] = await run(sbot.friends.hops)()
  t.error(err)
  t.deepEqual(hops, {
    [alice.id]: 0,
    [bob.id]: 1,
    [carol.id]: 1,
    [david.id]: -2
  })
  t.deepEqual(live, hops)

  await run(sbot.close)()
  sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false
    },
    path: dir
  })
  live = liveHops(sbot)

  const [err2] = await run(sbot.db.create)({keys: alice, content: u.unfollow(carol.id)})
  t.error(err2)
  const [err3] = await run(sbot.db.create)({keys: bob, content: u.follow(carol.id)})
  t.error(err3)

  const [err4, hops2] = await run(sbot.friends.hops)()
  t.error(err4)
  t.deepEqual(live, {
    [alice.id]: 0,
    [bob.id]: 1,
    [carol.id]: 2,
    [david.id]: -2
  })
  t.deepEqual(live, hops2)

  await run(sbot.close)()
  t.end()
})

tape('db2 unfollow', async (t) => {
  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()

  rimraf.sync(dir)
  mkdirp.sync(dir)

  let sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false
    },
    path: dir
  })
  let live = liveHops(sbot)

  await Promise.all([
    run(sbot.db.create)({keys: alice, content: u.follow(bob.id)}),
    run(sbot.db.create)({keys: alice, content: u.follow(carol.id)}),
    run(sbot.db.create)({keys: bob, content: u.follow(alice.id)}),
    run(sbot.db.create)({keys: carol, content: u.follow(alice.id)}),
  ])

  const [err, hops] = await run(sbot.friends.hops)()
  t.error(err)
  t.deepEqual(live, hops)

  await run(sbot.close)()
  sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false
    },
    path: dir
  })
  live = liveHops(sbot)

  const [err2] = await run(sbot.db.create)({keys: alice, content: u.unfollow(bob.id)})
  t.error(err2)

  const [err3, hops3] = await run(sbot.friends.hops)()
  t.error(err3)
  t.deepEqual(live, hops3)

  await run(sbot.close)()
  sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false
    },
    path: dir
  })

  const [err4, hopsAfter] = await run(sbot.friends.hops)()
  t.error(err4)
  t.deepEqual(hopsAfter, hops3)

  await run(sbot.close)()
  t.end()
})

tape('delete, compact, and reset social graph', async (t) => {
  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()

  rimraf.sync(dir)
  mkdirp.sync(dir)

  let sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false
    },
    path: dir
  })

  await Promise.all([
    run(sbot.db.create)({keys: alice, content: u.follow(bob.id)}),
    run(sbot.db.create)({keys: bob, content: u.follow(carol.id)}),
  ])

  const [err, hops] = await run(sbot.friends.hops)()
  t.error(err)
  t.deepEqual(hops, {
    [alice.id]: 0,
    [bob.id]: 1,
    [carol.id]: 2
  })

  await run(sbot.db.deleteFeed)(bob.id)
  t.pass("deleted bob's feed")

  await run(sbot.db.compact)()
  t.pass('compacted')

  await run(sbot.db.onDrain)('contacts')
  t.pass('reindexed contacts index')

  const [err2, hops2] = await run(sbot.friends.hops)()
  t.error(err2)
  t.deepEqual(hops2, {
    [alice.id]: 0,
    [bob.id]: 1
  })

  await run(sbot.close)()
  t.end()
})
