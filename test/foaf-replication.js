const test = require('tape')
const pull = require('pull-stream')
const { connect } = require('scuttle-testbot')
const crypto = require('crypto')
const { Server } = require('./util')

const caps = { shs: crypto.randomBytes(32).toString('base64') }

test('foaf replication', t => {
  t.plan(7)
  // this is about making sure replication happes immediately when you discover new peers
  // and are already connected to the same pub as they join

  const A = Server({ caps })
  const B = Server({ caps })
  const C = Server({ caps })

  C.publish({ type: 'success' }, (err, msg) => {
    t.error(err, 'C publishes a message')
    const testMsg = msg.key

    pull(
      A.createHistoryStream({ id: C.id, live: true }),
      pull.drain(msg => {
        console.log(msg.key, testMsg)
        if (msg.key === testMsg) {
          t.pass('A received message from foaf C')

          A.close(err => t.error(err, 'close'))
          B.close(err => t.error(err, 'close'))
          C.close(err => t.error(err, 'close'))
        }
      })
    )

    const name = id => {
      if (id === A.id) return 'A'
      if (id === B.id) return 'B (pub)'
      if (id === C.id) return 'C'
    }

    connect([A, B], { friends: true, name }, (err) => {
      t.error(err, 'A and B connect and friend')

      const DELAY = 1000
      // strangely I only see problems when this number is >= 1000
      setTimeout(() => {
        connect([C, B], { friends: true, name }, (err) => {
          t.error(err, 'B and C connect and friend')
        })
      }, DELAY)
    })
  })
})
