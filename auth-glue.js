module.exports = function authGlue (sbot, layered, isBlocking) {
  // Whenever we create a new block, immediately disconnect from peers we just
  // blocked, if they are connected at all
  layered.onEdge((orig, dest, value) => {
    // if WE are BLOCKING a CONNECTED PEER
    if (orig === sbot.id && value === -1 && sbot.peers[dest]) {
      sbot.peers[dest].forEach(rpc => rpc.close(true))
      sbot.peers[dest] = []
    }
  })

  // Blocked peers also cannot *initiate* new connections
  sbot.auth.hook(function (fn, args) {
    const self = this
    const [feedId, cb] = args
    isBlocking({ source: sbot.id, dest: feedId }, (_err, blocked) => {
      if (blocked) cb(new Error('client is blocked'))
      else fn.apply(self, args)
    })
  })
}
