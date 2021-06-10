const test = require('tape')
const pull = require('pull-stream')
const cont = require('cont')
const { connect } = require('scuttle-testbot')
const crypto = require('crypto')
const { Server } = require('./util')

const caps = { shs: crypto.randomBytes(32).toString('base64') }

test('foaf replication', t => {
  t.plan(10)
  // this is about making sure replication happes immediately when you discover new peers
  // and are already connected to the same pub as they join

  const A = Server({ caps })
  const B = Server({ caps })
  const C = Server({ caps })
  const name = id => {
    if (id === A.id) return 'A'
    if (id === B.id) return 'B'
    if (id === C.id) return 'C'
    throw new Error('unknown id', id)
  }
  console.log('A', A.id)
  console.log('B', B.id)
  console.log('C', C.id)

  C.publish({ type: 'success' }, (err, msg) => {
    t.error(err, 'C publishes a message')
    const testMsg = msg.key

    // check that A gets a message (transitively) from a foaf (C)
    const fail = setTimeout(() => {
      throw new Error('test failed')
    }, 4000)
    pull(
      A.createHistoryStream({ id: C.id, live: true }),
      pull.drain(msg => {
        if (msg.key === testMsg) {
          t.pass('A received message from foaf C')

          clearTimeout(fail)

          cont.para([
            cont(A.close),
            cont(B.close),
            cont(C.close)
          ], (err) => {
            t.error(err, 'all peers close')
            t.end()
          })
        }
      })
    )

    // Check A updates it's hops graph as new follows happen
    const expectedHopChanges = [
      { [A.id]: 0 },
      { [B.id]: 1 },
      { [C.id]: 2 }
    ]
    let n = 0
    pull(
      A.friends.hopStream({ live: true }),
      pull.drain(change => {
        t.deepEqual(
          change,
          expectedHopChanges[n],
          `A.friends.hopStream : { ${name(Object.keys(change)[0])}: ${n} }`
        )
        n++
      })
    )

    // Check A is calling replicate on peers as they come into hop range
    const expectedReplicateCalls = [
      [B.id, true],
      [C.id, true]
    ]
    let m = 0
    A.replicate.request.hook((fn, args) => {
      t.deepEqual(args, expectedReplicateCalls[m], `A.replicate.request(${name(args[0])}, true)`)
      m++

      fn(...args)
    })

    // have A and B connect + follow
    connect([A, B], { friends: true, name }, (err) => {
      t.error(err, 'A and B connect and friend')

      // have B and C connect + follow
      const DELAY = 2000
      // NOTE this delay is needed to see more intermittent replication behaviour
      setTimeout(() => {
        connect([C, B], { friends: true, name }, (err) => {
          t.error(err, 'B and C connect and friend')
        })
      }, DELAY)
    })
  })
})
