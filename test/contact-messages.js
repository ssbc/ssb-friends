const tape = require('tape')
const run = require('promisify-tuple')
const u = require('./util')

const feedId = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

tape('friends.follow()', async t => {
  const sbot = u.Server({ tribes: true })

  /* FOLLOW */
  const [err1, msg1] = await run(sbot.friends.follow)(feedId, {})
  t.error(err1)

  // NOTE get here just to confirm recps: undefined not present
  const [err2, value] = await run(sbot.get)(msg1.key)
  t.error(err2)
  t.deepEqual(
    value.content,
    {
      type: 'contact',
      contact: feedId,
      following: true
    },
    'publishes a follow message!'
  )

  /* UNFOLLOW */
  const [err3, msg3] = await run(sbot.friends.follow)(feedId, { state: false })
  t.error(err3)
  t.deepEqual(
    msg3.value.content,
    {
      type: 'contact',
      contact: feedId,
      following: false,
      recps: undefined
    },
    'publishes a unfollow message!'
  )

  /* PRIVATE FOLLOW */
  const [err4, msg4] = await run(sbot.friends.follow)(feedId, { recps: [sbot.id] })
  t.error(err4)
  t.match(msg4.value.content, /box\d$/, 'publishes a private follow')

  await run(sbot.close)()
  t.end()
})

tape('friends.block()', async t => {
  const sbot = u.Server({ tribes: true })

  /* BLOCK */
  const [err1, msg1] = await run(sbot.friends.block)(feedId, {})
  t.error(err1)

  // NOTE get here just to confirm recps: undefined not present
  const [err2, value] = await run(sbot.get)(msg1.key)
  t.error(err2)
  t.deepEqual(
    value.content,
    {
      type: 'contact',
      contact: feedId,
      blocking: true
    },
    'publishes a block message!'
  )

  /* UNBLOCK */
  const opts = {
    state: false,
    reason: 'we talked in person'
  }
  const [err3, msg3] = await run(sbot.friends.block)(feedId, opts)
  t.error(err3)
  t.deepEqual(
    msg3.value.content,
    {
      type: 'contact',
      contact: feedId,
      blocking: false,
      reason: 'we talked in person',
      recps: undefined
    },
    'publishes an unblock message!'
  )

  /* PRIVATE BLOCK */
  const [err4, msg4] = await run(sbot.friends.block)(feedId, { recps: [sbot.id] })
  t.error(err4)
  t.match(msg4.value.content, /box\d$/, 'publishes a private block')

  await run(sbot.close)()
  t.end()
})
