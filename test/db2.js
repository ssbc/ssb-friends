const tape = require('tape')
const os = require('os')
const path = require('path')
const ssbKeys = require('ssb-keys')
const { promisify: p } = require('util')
const pull = require('pull-stream')
const validate = require('ssb-validate')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const u = require('./util')

function liveFriends (ssbServer) {
  const live = {}
  pull(
    ssbServer.friends.createFriendStream({ live: true, meta: true }),
    pull.drain((friend) => {
      if (friend.sync) return
      live[friend.id] = friend.hops
    }),
  )
  return live
}

const dir = path.join(os.tmpdir(), 'friends-db2')

function Server(opts = {}) {
  return u.Server({
    db1: false,
    ...opts
  })
}

let state = validate.initial()

function addMsg(db, keys, content) {
  state = validate.appendNew(state, null, keys, content, Date.now())
  const value = state.queue.shift().value

  return p(db.add)(value)
}

tape('db2 friends test', async (t) => {
  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()

  let sbot = Server({
    keys: alice,
    friends: {
      hookAuth: false,
      hookReplicate: false
    },
    path: dir
  })
  let live = liveFriends(sbot)

  await Promise.all([
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
    .then(() => t.pass('add follow messages'))

  const hops = await p(sbot.friends.hops)()
    .catch(t.error)
  t.deepEqual(live, hops, 'live hops good')


  await p(sbot.close)()
    .catch(t.error)

  sbot = Server({
    rimraf: false,
    keys: alice,
    friends: {
      hookAuth: false,
      hookReplicate: false
    },
    path: dir
  })
  live = liveFriends(sbot)

  await p(setTimeout)(1000)

  await addMsg(sbot.db, bob, u.follow(carol.id))
    .catch(err => t.error(err, 'bob follows carol'))

  await p(sbot.db.onDrain)('contacts')
    .catch(err => t.error(err, 'onDrain contacts'))
  t.deepEqual(live, hops, 'live hops still good')

  await p(sbot.close)()
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
    friends: {
      hookAuth: false,
      hookReplicate: false
    },
    path: dir
  })
  let live = liveFriends(sbot)

  await Promise.all([
    addMsg(sbot.db, alice, u.follow(bob.id)),
    addMsg(sbot.db, alice, u.follow(carol.id)),
    addMsg(sbot.db, bob, u.follow(alice.id)),
    addMsg(sbot.db, carol, u.follow(alice.id))
  ])
    .catch(t.error)

  const hops = await p(sbot.friends.hops)()
    .catch(t.error)
  t.deepEqual(live, hops)

  await p(sbot.close)()
  sbot = Server({
    rimraf: false,
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false,
      hookReplicate: false
    },
    path: dir
  })
  live = liveFriends(sbot)

  await addMsg(sbot.db, alice, u.unfollow(bob.id))
    .catch(t.error)

  const hops3 = await p(sbot.friends.hops)()
    .catch(t.error)
  t.deepEqual(live, hops3)

  await p(sbot.close)()
  sbot = Server({
    rimraf: false,
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false,
      hookReplicate: false
    },
    path: dir
  })

  const hopsAfter = await p(sbot.friends.hops)()
    .catch(t.error)
  t.deepEqual(hopsAfter, hops3)

  await p(sbot.close)()
  t.end()
})
