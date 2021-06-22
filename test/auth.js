const tape = require('tape')
const caps = require('ssb-caps')
const run = require('promisify-tuple')
const sleep = require('util').promisify(setTimeout)
const u = require('./util')

tape('friends can connect to each other', async (t) => {
  const alice = u.Server({ caps })
  const bob = u.Server({ caps })

  const [err1] = await run(alice.friends.follow)(bob.id, {})
  t.error(err1, 'alice follows bob')

  const [err2] = await run(bob.friends.follow)(alice.id, {})
  t.error(err2, 'bob follows alice')

  const [err3, rpcAliceBob] = await run(alice.connect)(bob.getAddress())
  t.error(err3, 'alice can connect to bob')

  await sleep(500)

  const [err4] = await run(rpcAliceBob.close)(true)
  t.error(err4, 'we closed the connection')

  // Bob can connect to Alice
  const [err5, rpcBobAlice] = await run(bob.connect)(alice.getAddress())
  t.error(err5, 'bob can connect to alice')

  await sleep(500)

  const [err6] = await run(rpcBobAlice.close)(true)
  t.error(err6, 'we closed the connection')

  await run(alice.close)(true)
  await run(bob.close)(true)
  t.end()
})

tape('blocked peer cannot connect', async (t) => {
  const alice = u.Server({ caps })
  const bob = u.Server({ caps })

  const [err1] = await run(alice.friends.block)(bob.id, null)
  t.error(err1, 'alice blocks bob')

  const [err2] = await run(bob.friends.follow)(alice.id, null)
  t.error(err2, 'bob follows alice')

  const [err3, rpcBobAlice] = await run(bob.connect)(alice.getAddress())
  t.ok(err3, 'expected error when connecting bob to alice')
  t.match(err3.message, /server hung up/, 'error message is about hanging up')
  t.notOk(rpcBobAlice, 'rpcBobAlice does not exist')

  await run(alice.close)(true)
  await run(bob.close)(true)
  t.end()
})

tape('friendly connection closes when no longer friendly (1)', async (t) => {
  const alice = u.Server({ caps })
  const bob = u.Server({ caps })

  const [err1] = await run(alice.friends.follow)(bob.id, {})
  t.error(err1, 'alice follows bob')

  const [err2] = await run(bob.friends.follow)(alice.id, {})
  t.error(err2, 'bob follows alice')

  // Bob can connect to Alice
  const [err3, rpcBobAlice] = await run(bob.connect)(alice.getAddress())
  t.error(err3, 'bob can connect to alice')
  t.ok(rpcBobAlice, 'rpc exists')

  const [err4, result] = await run(rpcBobAlice.manifest)()
  t.error(err4, 'bob can call an RPC on alice')
  t.ok(result, 'bob gets a response')

  await sleep(500)

  const [err5] = await run(alice.friends.block)(bob.id, {})
  t.error(err5, 'alice blocks bob')

  const [err6, result2] = await run(rpcBobAlice.manifest)()
  t.ok(err6, 'bob cannot call an RPC on alice')
  t.notOk(result2, 'bob gets no response')

  await sleep(500)

  await run(alice.close)(true)
  await run(bob.close)(true)
  t.end()
})

tape('friendly connection closes when no longer friendly (2)', async (t) => {
  const alice = u.Server({ caps })
  const bob = u.Server({ caps })

  const [err1] = await run(alice.friends.follow)(bob.id, {})
  t.error(err1, 'alice follows bob')

  const [err2] = await run(bob.friends.follow)(alice.id, {})
  t.error(err2, 'bob follows alice')

  // Bob can connect to Alice
  const [err3, rpcBobAlice] = await run(bob.connect)(alice.getAddress())
  t.error(err3, 'bob can connect to alice')
  t.ok(rpcBobAlice, 'rpc exists')

  const [err4, result] = await run(rpcBobAlice.manifest)()
  t.error(err4, 'bob can call an RPC on alice')
  t.ok(result, 'bob gets a response')

  await sleep(500)

  // THIS IS THE ONLY THING THAT DIFFERS FROM THE PREVIOUS TEST
  const [err5] = await run(alice.publish)({
    type: 'contact',
    contact: bob.id,
    blocking: true
  })
  t.error(err5, 'alice blocks bob')

  const [err6, result2] = await run(rpcBobAlice.manifest)()
  t.ok(err6, 'bob cannot call an RPC on alice')
  t.notOk(result2, 'bob gets no response')

  await sleep(500)

  await run(alice.close)(true)
  await run(bob.close)(true)
  t.end()
})
