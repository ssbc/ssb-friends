const tape = require('tape')
const gen = require('ssb-generate')
const pull = require('pull-stream')
const run = require('promisify-tuple')
const u = require('./util')

const botA = u.Server({
  replicate: {
    hops: 100,
    legacy: false
  }
})

tape('empty database follow self', function (t) {
  pull(
    botA.friends.createFriendStream(),
    pull.collect((err, a) => {
      t.error(err)
      t.deepEqual(a, [botA.id])
      t.end()
    })
  )
})

tape('silly input for sbot.friend.follow is an error', t => {
  botA.friends.follow('not a feed id', {}, (err) => {
    t.match(err.message, /requires a feedId/)
    t.end()
  })
})

tape('silly input for sbot.friend.block throws', t => {
  botA.friends.block('not a feed id', {}, (err) => {
    t.match(err.message, /requires a feedId/)
    t.end()
  })
})

tape('live follows works', async (t) => {
  const a = []

  pull(
    botA.friends.createFriendStream({
      live: true,
      meta: true,
      hops: 10
    }),
    pull.drain(function (m) {
      a.push(m)
    })
  )

  const [err, peers] = await run(gen.initialize)(botA, 10, 2)
  t.error(err, 'initialize test data')

  t.true(a.length >= 1, 'a.length === ' + a.length)

  const seen = {}
  let count = 0
  const notSeen = {}

  peers.forEach((v) => {
    notSeen[v.id] = true
  })

  a.forEach((v) => {
    if (!seen[v.id]) {
      seen[v.id] = true
      delete notSeen[v.id]
      count++
    }
  })

  const [err2, hops] = await run(botA.friends.hops)()
  t.error(err2)
  for (const k in notSeen) {
    console.log('Not Seen', k, hops[k])
  }

  t.deepEqual(notSeen, {})
  t.deepEqual(count, peers.length, 'all peers streamed')
  // b.forEach(function (e) { t.ok(e.hops <= 1, 'b '+e.hops+' hops <= 1') })
  // c.forEach(function (e) { t.ok(e.hops <= 2, 'c '+e.hops+' hops <= 2') })
  // t.ok(a.length >= b.length, '1 hops')
  // t.ok(c.length >= b.length, '2 hops')

  const [err3] = await run(botA.close)()
  t.error(err3)
  t.end()
})

tape('chill plugin order', t => {
  const createSbot = require('scuttle-testbot')
    .use(require('..'))
    .use(require('ssb-replicate'))

  const bot = createSbot({
    replicate: {
      hops: 100,
      legacy: false
    }
  })

  t.true(bot, 'loads plugins in whatever order fine')
  bot.close(err => {
    t.error(err, 'close bot')
    t.end()
  })
})
