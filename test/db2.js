const ssbKeys = require('ssb-keys')
const cont = require('cont')
const tape = require('tape')
const u = require('./util')
const pull = require('pull-stream')
const validate = require('ssb-validate')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const os = require('os')
const path = require('path')

const SecretStack = require('secret-stack')
const caps = require('ssb-caps')

function liveFriends (ssbServer) {
  const live = {}
  pull(
    ssbServer.friends.createFriendStream({ live: true, meta: true }),
    pull.drain(function (friend) {
      if (friend.sync) return
      live[friend.id] = friend.hops
    })
  )
  return live
}

const dir = path.join(os.tmpdir(), "friends-db2")

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
  state = validate.appendNew(
    state,
    null,
    keys,
    content,
    Date.now()
  )

  return (cb) => {
    value = state.queue.shift().value
    db.add(value, cb)
  }
}

tape('db2 friends test', function (t) {
  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()

  let sbot = Server({
    keys: alice,
    db2: true,
    path: dir
  })
  let live = liveFriends(sbot)

  cont.para([
    addMsg(sbot.db, alice, {
      type: 'contact',
      contact: bob.id,
      following: true
    }),
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
  ])(function (err, results) {
    sbot.friends.hops(function (err, hops) {
      if (err) throw err
      t.deepEqual(live, hops)

      sbot.close(() => {
        sbot = Server({
          keys: alice,
          db2: true,
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
