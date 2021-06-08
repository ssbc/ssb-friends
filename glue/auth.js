module.exports = function authGlue(sbot, isBlocking) {
  // opinion: do not authorize peers blocked by this node.
  sbot.auth.hook(function (fn, args) {
    const self = this
    const [feedId, cb] = args
    isBlocking({ source: sbot.id, dest: feedId }, (err, blocked) => {
      if (err) console.error(err)

      if (blocked) cb(new Error('client is blocked'))
      else fn.apply(self, args)
    })
  })
}
