const tape = require('tape')
const run = require('promisify-tuple')
const u = require('./util')

tape('follow() and isFollowing() privately', async (t) => {
  const sbot = u.Server({tribes: true})

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
  t.match(msg2.value.content, /box\d$/, 'publishes a private follow')

  const [err3, response3] = await run(sbot.friends.isFollowing)({
    source,
    dest,
  })
  t.error(err3, 'no error')
  t.true(response3, 'following')

  await run(sbot.close)()
  t.end()
})

tape('block() and isBlocking() privately', async (t) => {
  const sbot = u.Server({tribes: true})

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
  t.match(msg2.value.content, /box\d$/, 'publishes a private block')

  const [err3, response3] = await run(sbot.friends.isBlocking)({
    source,
    dest,
  })
  t.error(err3, 'no error')
  t.true(response3, 'blocking')

  await run(sbot.close)()
  t.end()
})
