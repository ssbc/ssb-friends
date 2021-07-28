const tape = require('tape')
const os = require('os')
const path = require('path')
const run = require('promisify-tuple')
const ssbKeys = require('ssb-keys')
const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const dir = path.join(os.tmpdir(), 'friends-db2')

function Server(opts = {}) {
  const stack = SecretStack({caps})
    .use(require('ssb-db2'))
    .use(require('ssb-db2/compat'))
    .use(require('..'))

  return stack(opts)
}

tape('follow() and isFollowing() privately in ssb-db2', async (t) => {
  rimraf.sync(dir)
  mkdirp.sync(dir)
  const sbot = Server({
    keys: ssbKeys.generate(),
    db2: true,
    friends: {
      hookAuth: false,
    },
    path: dir,
  })

  const source = sbot.id
  const dest = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

  const [err1, response1] = await run(sbot.friends.isFollowing)({
    source,
    dest,
  })
  t.error(err1, 'no error')
  t.false(response1, 'not following')

  const [err2, msg2] = await run(sbot.friends.follow)(dest, {
    recps: [source],
  })
  t.error(err2, 'no error')
  t.match(msg2.value.content, /box$/, 'publishes a private follow')

  const [err3, response3] = await run(sbot.friends.isFollowing)({
    source,
    dest,
  })
  t.error(err3, 'no error')
  t.true(response3, 'following')

  await run(sbot.close)()
  t.end()
})

tape('block() and isBlocking() privately in ssb-db2', async (t) => {
  rimraf.sync(dir)
  mkdirp.sync(dir)
  const sbot = Server({
    keys: ssbKeys.generate(),
    db2: true,
    friends: {
      hookAuth: false,
    },
    path: dir,
  })

  const source = sbot.id
  const dest = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

  const [err1, response1] = await run(sbot.friends.isBlocking)({
    source,
    dest,
  })
  t.error(err1, 'no error')
  t.false(response1, 'not blocking')

  const [err2, msg2] = await run(sbot.friends.block)(dest, {
    recps: [source],
  })
  t.error(err2, 'no error')
  t.match(msg2.value.content, /box$/, 'publishes a private block')

  const [err3, response3] = await run(sbot.friends.isBlocking)({
    source,
    dest,
  })
  t.error(err3, 'no error')
  t.true(response3, 'blocking')

  await run(sbot.close)()
  t.end()
})
