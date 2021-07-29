const tape = require('tape')
const os = require('os')
const path = require('path')
const run = require('promisify-tuple')
const sleep = require('util').promisify(setTimeout)
const ssbKeys = require('ssb-keys')
const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const dir = path.join(os.tmpdir(), 'friends-db2')

function Server (opts = {}) {
  const stack = SecretStack({ caps })
    .use(require('ssb-db'))
    .use(require('..'))

  return stack(opts)
}

const aliceKeys = ssbKeys.generate()

tape('follow() and isFollowing() privately', async (t) => {
  rimraf.sync(dir)
  mkdirp.sync(dir)
  const sbot = Server({
    keys: aliceKeys,
    friends: {
      hookAuth: false
    },
    path: dir
  })

  const source = sbot.id
  const dest = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

  const [err1, response1] = await run(sbot.friends.isFollowing)({
    source,
    dest
  })
  t.error(err1, 'no error')
  t.false(response1, 'not following')

  const [err2, msg2] = await run(sbot.friends.follow)(dest, {
    recps: [source]
  })
  t.error(err2, 'no error')
  t.match(msg2.value.content, /box$/, 'publishes a private follow')

  await sleep(500)

  const [err3, response3] = await run(sbot.friends.isFollowing)({
    source,
    dest
  })
  t.error(err3, 'no error')
  t.true(response3, 'following')

  const [err4, details4] = await run(sbot.friends.isFollowing)({
    source,
    dest,
    details: true
  })
  t.error(err4, 'no error')
  t.deepEqual(
    details4,
    { response: true, private: true },
    'following with details'
  )

  await run(sbot.close)()
  t.end()
})

tape('isFollowing() still works after sbot restarts', async (t) => {
  const sbot = Server({
    keys: aliceKeys,
    friends: {
      hookAuth: false
    },
    path: dir
  })

  const source = sbot.id
  const dest = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

  const [err4, details4] = await run(sbot.friends.isFollowing)({
    source,
    dest,
    details: true
  })
  t.error(err4, 'no error')
  t.deepEqual(
    details4,
    { response: true, private: true },
    'following with details'
  )

  await run(sbot.close)()
  t.end()
})

tape('block() and isBlocking() privately', async (t) => {
  rimraf.sync(dir)
  mkdirp.sync(dir)
  const sbot = Server({
    keys: aliceKeys,
    friends: {
      hookAuth: false
    },
    path: dir
  })

  const source = sbot.id
  const dest = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

  const [err1, response1] = await run(sbot.friends.isBlocking)({
    source,
    dest
  })
  t.error(err1, 'no error')
  t.false(response1, 'not blocking')

  const [err2, msg2] = await run(sbot.friends.block)(dest, {
    recps: [source]
  })
  t.error(err2, 'no error')
  t.match(msg2.value.content, /box$/, 'publishes a private block')

  await sleep(500)

  const [err3, response3] = await run(sbot.friends.isBlocking)({
    source,
    dest
  })
  t.error(err3, 'no error')
  t.true(response3, 'blocking')

  const [err4, details4] = await run(sbot.friends.isBlocking)({
    source,
    dest,
    details: true
  })
  t.error(err4, 'no error')
  t.deepEqual(
    details4,
    { response: true, private: true },
    'blocking with details'
  )

  await run(sbot.close)()
  t.end()
})
