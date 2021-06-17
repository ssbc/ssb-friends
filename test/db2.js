const tape = require('tape')
const os = require('os')
const path = require('path')
const ssbKeys = require('ssb-keys')
const run = require('promisify-tuple')
const pull = require('pull-stream')
const validate = require('ssb-validate')
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
    ssbServer.friends.hopStream({ live: true }),
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

function Server(opts = {}) {
  const stack = SecretStack({ caps })
    .use(require('ssb-db2'))
    .use(require('..'))

  return stack(opts)
}

let state = validate.initial()

function addMsg(db, keys, content) {
  state = validate.appendNew(state, null, keys, content, Date.now())

  return run((cb) => {
    value = state.queue.shift().value
    db.add(value, cb)
  })()
}

tape('db2 friends test', async (t) => {
  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()

  let sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false,
    },
    path: dir
  })
  let live = liveHops(sbot)

  await Promise.all([
    // Publish some irrelevant messages to test that the db2 index doesn't crash
    addMsg(sbot.db, alice, { type: 'post', text: 'hello world' }),
    addMsg(sbot.db, alice, { type: 'contact', contact: 'not a feed' }),
    // Publish actual follows
    addMsg(sbot.db, alice, u.follow(bob.id)),
    addMsg(sbot.db, alice, u.follow(carol.id)),
    addMsg(sbot.db, alice, u.follow(alice.id)),
    addMsg(sbot.db, bob, u.follow(alice.id)),
    addMsg(sbot.db, bob, {
      type: 'contact',
      contact: carol.id,
      following: false,
      flagged: true
    }),
    addMsg(sbot.db, carol, u.follow(alice.id))
  ])

  const [err, hops] = await run(sbot.friends.hops)()
  t.error(err)
  t.deepEqual(live, hops)

  await run(sbot.close)()
  sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false,
    },
    path: dir
  })
  live = liveHops(sbot)

  const [err2] = await addMsg(sbot.db, bob, u.follow(carol.id))
  t.error(err2)

  await run(sbot.db.onDrain)('contacts')
  t.deepEqual(live, hops)

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
      hookAuth: false,
    },
    path: dir
  })
  let live = liveHops(sbot)

  await Promise.all([
    addMsg(sbot.db, alice, u.follow(bob.id)),
    addMsg(sbot.db, alice, u.follow(carol.id)),
    addMsg(sbot.db, bob, u.follow(alice.id)),
    addMsg(sbot.db, carol, u.follow(alice.id))
  ])

  const [err, hops] = await run(sbot.friends.hops)()
  t.error(err)
  t.deepEqual(live, hops)

  await run(sbot.close)()
  sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false,
    },
    path: dir
  })
  live = liveHops(sbot)

  const [err2] = await addMsg(sbot.db, alice, u.unfollow(bob.id))
  t.error(err2)

  const [err3, hops3] = await run(sbot.friends.hops)()
  t.error(err3)
  t.deepEqual(live, hops3)

  await run(sbot.close)()
  sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false,
    },
    path: dir
  })

  const [err4, hopsAfter] = await run(sbot.friends.hops)()
  t.error(err4)
  t.deepEqual(hopsAfter, hops3)

  await run(sbot.close)()
  t.end()
})
