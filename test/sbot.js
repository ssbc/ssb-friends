const pull = require('pull-stream')
const tape = require('tape')
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
    pull.collect(function (err, a) {
      t.error(err)
      t.deepEqual(a, [botA.id])
      t.end()
    })
  )
})

const gen = require('ssb-generate')

tape('live follows works', function (t) {
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

  gen.initialize(botA, 10, 2, function (err, peers, hops) {
    t.error(err, 'initialize test data')

    console.log(a.length, hops)

    const seen = {}
    let count = 0
    const notSeen = {}

    peers.forEach(function (v) {
      notSeen[v.id] = true
    })

    a.forEach(function (v) {
      if (!seen[v.id]) {
        seen[v.id] = true
        delete notSeen[v.id]
        count++
      }
    })

    botA.friends.hops(function (err, hops) {
      if (err) throw err
      for (const k in notSeen) { console.log('NS', k, hops[k]) }

      t.deepEqual(notSeen, {})
      t.deepEqual(count, peers.length, 'all peers streamed')
      //    b.forEach(function (e) { t.ok(e.hops <= 1, 'b '+e.hops+' hops <= 1') })
      //    c.forEach(function (e) { t.ok(e.hops <= 2, 'c '+e.hops+' hops <= 2') })
      //    t.ok(a.length >= b.length, '1 hops')
      //    t.ok(c.length >= b.length, '2 hops')
      //
      botA.close(err => {
        t.end(err, 'botA closed')
      })
    })
  })
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
