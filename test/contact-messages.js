const tape = require('tape')
const u = require('./util')

const feedId = '@th3J6gjmDOBt77SRX1EFFWY0aH2Wagn21iUZViZFFxk=.ed25519'

tape('follow', t => {
  const sbot = u.Server({ tribes: true })

  /* FOLLOW */
  sbot.friends.follow(feedId, {}, (err, msg) => {
    if (err) throw err

    // NOTE get here just to confirm recps: undefined not present
    sbot.get(msg.key, (_, value) => {
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
      sbot.friends.follow(feedId, { state: false }, (err, msg) => {
        if (err) throw err

        t.deepEqual(
          msg.value.content,
          {
            type: 'contact',
            contact: feedId,
            following: false,
            recps: undefined
          },
          'publishes a unfollow message!'
        )

        /* PRIVATE FOLLOW */
        sbot.friends.follow(feedId, { recps: [sbot.id] }, (err, msg) => {
          if (err) throw err
          t.match(msg.value.content, /box\d$/, 'publishes a private follow')

          sbot.close(t.end)
        })
      })
    })
  })
})

tape('block', t => {
  const sbot = u.Server({ tribes: true })

  /* BLOCK */
  sbot.friends.block(feedId, {}, (err, msg) => {
    if (err) throw err

    // NOTE get here just to confirm recps: undefined not present
    sbot.get(msg.key, (_, value) => {
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
      sbot.friends.block(feedId, opts, (err, msg) => {
        if (err) throw err

        t.deepEqual(
          msg.value.content,
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
        sbot.friends.block(feedId, { recps: [sbot.id] }, (err, msg) => {
          if (err) throw err
          t.match(msg.value.content, /box\d$/, 'publishes a private block')

          sbot.close(t.end)
        })
      })
    })
  })
})
