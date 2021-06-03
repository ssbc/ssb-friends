const ref = require('ssb-ref')
const Server = require('scuttle-testbot')

exports.Server = function Testbot (opts = {}) {
  let stack = Server
    .use(require('ssb-replicate'))
    .use(require('..'))

  if (opts.tribes === true)
    stack = stack.use(require('ssb-tribes'))

  return stack(opts)
}

exports.follow = function (id) {
  return {
    type: 'contact', contact: id, following: true
  }
}
exports.unfollow = function (id) {
  return {
    type: 'contact', contact: id, following: false
  }
}
exports.block = function (id) {
  return {
    type: 'contact', contact: id, blocking: true
  }
}
exports.unblock = function (id) {
  return {
    type: 'contact', contact: id, blocking: false
  }
}

exports.pub = function (address) {
  return {
    type: 'pub',
    address: ref.parseAddress(address)
  }
}

exports.file = function (hash) {
  return {
    type: 'file',
    file: hash
  }
}
