var G           = require('graphreduce')
var Reduce      = require('flumeview-reduce')
var pull        = require('pull-stream')
var FlatMap     = require('pull-flatmap')
//var mlib        = require('ssb-msgs')
//var pushable    = require('pull-pushable')
//var mdm         = require('mdmanifest')
//var valid       = require('../lib/validators')
//var apidoc      = require('../lib/apidocs').friends
var ref         = require('ssb-ref')
var Obv         = require('obv')

var F           = require('./alg')
var block       = require('./block')

// friends plugin
// methods to analyze the social graph
// maintains a 'follow' and 'flag' graph

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

function isFriend (friends, a, b) {
  return friends[a] && friends[b] && friends[a][b] && friends[b][a]
}

exports.name = 'friends'
exports.version = '1.0.0'
exports.manifest = {
  get: 'async',
  createFriendStream: 'source',
  hops: 'async'
}

//mdm.manifest(apidoc)

exports.init = function (sbot, config) {
  var post = Obv()
  post.set({})
  var index = sbot._flumeUse('friends', Reduce(2, function (g, rel) {
    if(!g) g = {}
    G.addEdge(g, rel.from, rel.to, rel.value)
    return g
  }, function (data) {
    if(data.value.content.type === 'contact' && ref.isFeed(data.value.content.contact)) {
      var tristate = (
        data.value.content.following ? true
      : data.value.content.flagged || data.value.content.blocking ? false
      : null
      )
      return {
        from: data.value.author,
        to: data.value.content.contact,
        value: tristate
      }
    }
  }))

  function createFriendStream (opts) {
    opts = opts || {}
    var live = opts.live === true
    var meta = opts.meta === true
    var start = opts.start || sbot.id
    var reachable
    //mabye this could be rewritten cleaner with
    //index.value (an observable) instead?
    return pull(
      index.stream(opts),
      FlatMap(function (v) {
        if(!v) return []

        //this code handles real time streaming of the hops map.
        function push (to, hops) {
          out.push(meta ? {id: to, hops: hops} : to)
        }

        var out = [], g = post.value

        //the edge has already been added to g
        if(!reachable) {
          reachable = F.reachable(g, start, block)
          for(var k in reachable)
            if(block.isWanted(reachable[k]))
              push(k, reachable[k][0])
        } else {
          var _reachable = F.reachable(g, start, block)
          var patch = F.diff(reachable, _reachable, block)
          for(var k in patch) {
            if(patch[k] == null || patch[k][0] == null || patch[k][0] > patch[k][1])
              push(k, -1)
            else if(block.isWanted(patch[k]))
              push(k, patch[k][0])
          }
          reachable = _reachable
        }
        return out
      })

    )
  }


  //BLOCKING

  var g = {}

  post(function (_g) {
    g = _g
  })

  function isBlocked (_opts) {
    var opts
    if(!g) return //only possible briefly at startup
    if('string' === typeof _opts)
      return g[sbot.id] ? g[sbot.id][_opts] === false : false
    return g[_opts.source] ? g[_opts.source][_opts.dest] === false : false
  }

  //should things like createHistoryStream instead
  //call a block prehook?
  sbot.createHistoryStream.hook(function (fn, args) {
    var opts = args[0], id = this.id
    //reminder: this.id is the remote caller.
    if(opts.id !== this.id && isBlocked({source: opts.id, dest: id})) {
      return function (abort, cb) {
        //just give them the cold shoulder
      }
//      return fn({id: null, sequence: 0})
    } else
      return pull(
        fn.apply(this, args),
        //break off this feed if they suddenly block
        //the recipient.
        pull.take(function (msg) {
          //handle when createHistoryStream is called with keys: true
          if(!msg.content && msg.value.content)
            msg = msg.value
          if(msg.content.type !== 'contact') return true
          return !(
            (msg.content.flagged || msg.content.blocking) &&
            msg.content.contact === id
          )
        })
      )
  })

  sbot.auth.hook(function (fn, args) {
    if(isBlocked(args[0])) args[1](new Error('client is blocked'))
    else return fn.apply(this, args)
  })

  // ^^ BLOCKING

  // REPLICATION
  pull(
    createFriendStream({live: true, meta: true}),
    // filter out duplicates, and also keep track of what we expect to receive
    // lookup the latest sequence from each user
    // TODO: use paramap?
    pull.drain(function (data) {
      if(data.sync) return
      if(data.hops >= 0)
        sbot.replicate.request(data.id)
      else
        sbot.replicate.request(data.id, false)
    })
  )
  //


  index.since(function () {
    //it looks async but this will always be sync after loading
    index.get(null, function (_, v) {
      post.set(v)
    })
  })

  return {
    post: post,
    get: function (opts, cb) {
      index.get(opts, cb)
    },

    createFriendStream: createFriendStream,
    //legacy, debugging
    hops: function (opts, cb) {
      if(isFunction(opts))
        cb = opts, opts = {}
      opts = opts || {}
      if(isString(opts))
        opts = {start: opts}
      index.get(null, function (err, g) {
        if(err) cb(err)
        else cb(null, G.hops(g, opts.start || sbot.id, 0, opts.hops || 3))
      })
    }
  }
}



