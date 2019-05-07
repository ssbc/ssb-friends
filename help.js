var SourceDest = {
  source: {
    type: 'FeedId',
    description: 'the feed which posted the contact message'
  },
  dest: {
    type: 'FeedId',
    description: 'the feed the contact message pointed at'
  }
}

var HopsOpts = {
  start: {
    type: 'FeedId',
    description: 'feed at which to start traversing graph from, default to your own feed id'
  },
  max: {
    type: 'number',
    description: 'include feeds less than or equal to this number of hops',
  }
}

var StreamOpts = Object.assign(
  HopsOpts, {
    live: {
      type: 'boolean',
      description: 'include real time results, defaults to false',
    },
    old: {
      type: 'boolean',
      description: 'include old results, defaults to true'
    }
  }
)

module.exports = {
  description: 'track what feeds are following or blocking each other',
  commands: {
    isFollowing: {
      type: 'async',
      description: 'check if a feed is following another',
      args: SourceDest
    },
    isBlocking: {
      type: 'async',
      description: 'check if a feed is blocking another',
      args: SourceDest
    },
    hops: {
      type: 'async',
      description: 'dump the map of hops, show all feeds, and how far away they are from start',
      args: HopsOpts
    },
    hopStream: {
      type: 'source',
      description: 'stream real time changes to hops. output is series of `{<FeedId>: <hops>,...}` merging these together will give the output of hops',
      args: StreamOpts
    },

    get: {
      type: 'async',
      description: 'dump internal state of friends plugin, the stored follow graph',
      args: {}
    },
    stream: {
      type: 'source',
      description: 'stream real time changes to graph. of hops, output of `get`, followed by {from: <FeedId>, to: <FeedId>: value: true|null|false, where true represents follow, null represents unfollow, and false represents block.',
      args: StreamOpts
    },
    createFriendStream: {
      type: 'source',
      description: 'same as `stream`, but output is series of `{id: <FeedId>, hops: <hops>}`',
      args: StreamOpts
    },
  }
}



