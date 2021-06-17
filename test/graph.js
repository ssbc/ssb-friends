const tape = require('tape')
const pull = require('pull-stream')
const run = require('promisify-tuple')
const u = require('./util')

const bot = u.Server({
  friends: {
    hops: 2,
  },
})

tape('graphStream', async (t) => {
  const feedA = bot.createFeed()
  const feedB = bot.createFeed()
  const feedC = bot.createFeed()

  const expected = [
    {},
    {source: feedA.id, dest: feedB.id, value: 1},
    {source: feedB.id, dest: feedC.id, value: 1},
    {source: feedC.id, dest: feedA.id, value: -1},
  ]
  t.plan(expected.length)

  pull(
    bot.friends.graphStream({live: true, old: true}),
    pull.drain(
      (x) => {
        t.deepEqual(x, expected.shift(), 'expected')
      },
      () => {
        t.fail('graphStream should not end')
      },
    ),
  )

  // feedA -> feedB
  await run(feedA.publish)({
    type: 'contact',
    contact: feedB.id,
    following: true,
  })

  // feedB -> feedC
  await run(feedB.publish)({
    type: 'contact',
    contact: feedC.id,
    following: true,
  })

  // feedC blocks feedA
  await run(feedC.publish)({
    type: 'contact',
    contact: feedA.id,
    blocking: true,
  })
})

tape('teardown', (t) => {
  bot.close(t.end)
})
