const tape = require('tape')
const os = require('os')
const path = require('path')
const cont = require('cont')
const ssbKeys = require('ssb-keys')
const pull = require('pull-stream')
const validate = require('ssb-validate')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
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

  return (cb) => {
    value = state.queue.shift().value
    db.add(value, cb)
  }
}

tape('db2 friends test', (t) => {
  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()

  let sbot = Server({
    keys: alice,
    db2: true,
    friends: {
      hookAuth: false,
      hookReplicate: false
    },
    path: dir
  })
  let live = liveFriends(sbot)

  cont.para([
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
  ])((err, results) => {
    sbot.friends.hops((err, hops) => {
      if (err) throw err
      t.deepEqual(live, hops)

      sbot.close(() => {
        sbot = Server({
          keys: alice,
          db2: true,
          friends: {
            hookAuth: false,
            hookReplicate: false
          },
          path: dir
        })
        live = liveFriends(sbot)

        addMsg(sbot.db, bob, {
          type: 'contact',
          contact: carol.id,
          following: true
        })((err) => {
          if (err) throw err

          sbot.db.onDrain('contacts', () => {
            t.deepEqual(live, hops)
            sbot.close(t.end)
          })
        })
      })
    })
  })
})

tape('db2 unfollow', (t) => {
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
      hookReplicate: false
    },
    path: dir
  })
  let live = liveFriends(sbot)

  cont.para([
    addMsg(sbot.db, alice, u.follow(bob.id)),
    addMsg(sbot.db, alice, u.follow(carol.id)),
    addMsg(sbot.db, bob, u.follow(alice.id)),
    addMsg(sbot.db, carol, u.follow(alice.id))
  ])((err, results) => {
    sbot.friends.hops((err, hops) => {
      if (err) throw err
      t.deepEqual(live, hops)

      sbot.close(() => {
        sbot = Server({
          keys: alice,
          db2: true,
          friends: {
            hookAuth: false,
            hookReplicate: false
          },
          path: dir
        })
        live = liveFriends(sbot)

        addMsg(sbot.db, alice, u.unfollow(bob.id))((err) => {
          if (err) throw err

          sbot.friends.hops((err, hops) => {
            t.deepEqual(live, hops)

            sbot.close(() => {
              sbot = Server({
                keys: alice,
                db2: true,
                friends: {
                  hookAuth: false,
                  hookReplicate: false
                },
                path: dir
              })

              sbot.friends.hops((err, hopsAfter) => {
                t.deepEqual(hopsAfter, hops)
                sbot.close(t.end)
              })
            })
          })
        })
      })
    })
  })
})
