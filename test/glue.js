const tape = require('tape')
const ssbKeys = require('ssb-keys')
const Server = require('scuttle-testbot')
const { promisify: p } = require('util')
const u = require('./util')

const followedKeys = ssbKeys.generate()
const blockedKeys = ssbKeys.generate()

tape('listen to hopStream and requests replication of follows', (t) => {
  t.pass('followed feed is ' + followedKeys.id)

  const stack = Server
    .use({
      name: 'replicate',
      init () {
        return {
          request (feed, bool) {
            if (feed === sbot.id) return
            t.equals(feed, followedKeys.id, 'requested feed id matches')
            t.true(bool, 'bool is true')
            sbot.close(err => {
              t.error(err, 'close sbot')
              t.end()
            })
          },
          block () { }
        }
      }
    })
    .use(require('..'))

  const sbot = stack({
    db1: true,
    friends: {
      hops: 2
    }
  })

  sbot.friends.follow(followedKeys.id, {}, (err, msg) => {
    t.error(err, 'no error when following')
    t.ok(msg, 'contact msg is truthy')
  })
})

tape('listen to hopStream and stops replication of blocks', (t) => {
  t.pass('blocked feed is ' + blockedKeys.id)

  const expected = [
    [blockedKeys.id, true],
    [blockedKeys.id, false]
  ]

  const stack = Server
    .use({
      name: 'replicate',
      init () {
        return {
          request () {},
          block (orig, dest, bool) {
            if (expected.length === 0) t.fail('no unexpeted blocks!')

            const [expectedDest, expectedBool] = expected.shift()
            t.equals(orig, sbot.id, 'me blocking someone')
            t.equals(dest, expectedDest, 'blocked feed id matches')
            t.equals(bool, expectedBool, 'bool matches')

            if (expected.length === 1) {
              sbot.friends.block(blockedKeys.id, { state: false }, (err, msg) => {
                t.error(err, 'no error when unblocking')
                t.ok(msg, 'contact msg is truthy')
              })
            } else if (expected.length === 0) {
              sbot.close(err => {
                t.error(err, 'close sbot')
                t.end()
              })
            }
          }
        }
      }
    })
    .use(require('..'))

  const sbot = stack({
    db1: true,
    friends: {
      hops: 2
    }
  })

  sbot.friends.block(blockedKeys.id, {}, (err, msg) => {
    t.error(err, 'no error when blocking')
    t.ok(msg, 'contact msg is truthy')
  })
})

tape('pub initial sync', async (t) => {
  const run = u.Run(t)

  const alice = u.Server({ name: 'alice' })
  const bob = u.Server({ name: 'bob' })
  const pub = u.Server({ name: 'pub' })
  const peers = [alice, bob, pub]

  // const name = (id) => peers.find(p => p.id === id)?.name || id
  t.teardown(() => peers.forEach(p => p.close(true)))

  await p(alice.publish)({ type: 'hello' })
  const invite = await p(pub.invite.create)({ uses: 2 })

  await new Promise((resolve) => {
    // bob listens for hello from alice
    bob.post(m => {
      if (m.value.author === alice.id && m.value.content.type === 'hello') {
        t.pass('bob heard from alice (via transitive friend => pub)')

        resolve() // resolves the promise
      }
    })

    run('alice joins pub', p(alice.invite.accept)(invite))
      .then(async () => {
        await p(setTimeout)(2000)
      })
      .then(() => run('bob joins pub', p(bob.invite.accept)(invite)))
  })

  t.end()
})
