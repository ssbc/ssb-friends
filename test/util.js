const ref = require('ssb-ref')
const Server = require('scuttle-testbot')

exports.Server = function Testbot (opts = {}) {
  if (opts.db1 === undefined) opts.db1 = true

  const stack = Server

  if (opts.db1) {
    stack.use(require('ssb-replicate'))

    if (opts.tribes === true) {
      stack
        .use(require('ssb-backlinks'))
        .use(require('ssb-query'))
        .use(require('ssb-tribes'))
    }
  } else {
    stack.use(require('ssb-db2/compat/ebt'))
  }

  stack.use(require('..'))

  return stack({
    db1: true,
    ...opts
  })
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
