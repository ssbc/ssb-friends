const tape = require('tape')
const { promisify: p } = require('util')
const u = require('./util')

const feedId = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

tape('friends.follow()', async t => {
  const sbot = u.Server({ tribes: true })

  /* FOLLOW */
  const msg1 = await p(sbot.friends.follow)(feedId, {})
    .catch(t.error)

  // NOTE get here just to confirm recps: undefined not present
  const value = await p(sbot.get)(msg1.key)
    .catch(t.error)
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
  const msg3 = await p(sbot.friends.follow)(feedId, { state: false })
    .catch(t.error)
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
  const msg4 = await p(sbot.friends.follow)(feedId, { recps: [sbot.id] })
    .catch(t.error)
  t.match(msg4.value.content, /box\d$/, 'publishes a private follow')

  await p(sbot.close)()
  t.end()
})

tape('friends.block()', async t => {
  const sbot = u.Server({ tribes: true })

  /* BLOCK */
  const msg1 = await p(sbot.friends.block)(feedId, {})
    .catch(t.error)

  // NOTE get here just to confirm recps: undefined not present
  const value = await p(sbot.get)(msg1.key)
    .catch(t.error)
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
  const msg3 = await p(sbot.friends.block)(feedId, opts)
    .catch(t.error)
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
  const msg4 = await p(sbot.friends.block)(feedId, { recps: [sbot.id] })
    .catch(t.error)
  t.match(msg4.value.content, /box\d$/, 'publishes a private block')

  await p(sbot.close)()
  t.end()
})
