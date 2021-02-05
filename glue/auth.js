module.exports = function (sbot, isBlocking) {
  // opinion: do not authorize peers blocked by this node.
  sbot.auth.hook(function (fn, args) {
    const self = this
    isBlocking({ source: sbot.id, dest: args[0] }, (err, blocked) => {
      if (err) console.error(err)

      if (blocked) args[1](new Error('client is blocked'))
      else fn.apply(self, args)
    })
  })
}
