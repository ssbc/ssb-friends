# ssb-friends

*Calculates the SSB social graph based on "contact" messages (such as follows
and blocks), and provides APIs for you to query the social graph.*

Based on [dynamic-dijkstra](https://github.com/dominictarr/dynamic-dijkstra)
module, see its Readme for an in-depth discussion of the algorithm.

## Installation

**Prerequisites:**

- Requires **Node.js 10** or higher
- Requires **ssb-db** or **ssb-db2**

```
npm install --save ssb-friends
```

Add this secret-stack plugin like this:

```diff
 const SecretStack = require('secret-stack')
 const caps = require('ssb-caps')

 const createSsbServer = SecretStack({ caps })
     .use(require('ssb-master'))
     .use(require('ssb-db'))
+    .use(require('ssb-friends'))
     .use(require('ssb-conn'))
     // ...
```

## Usage

In ssb-friends, the relation between any two peers can be in 3 states, and each
of those states are expressed by the following numbers (read more in the "Edge
weights" section below):

- **Following:** zero or positive
- **Blocking:** -1
- **Not following and not blocking:** -2

There are APIs for creating follows and blocks (which under the hood will just
publish messages of type `"contact"` on the log), and the are APIs for checking
whether A follows or blocks B.

Then, there are social graph APIs such as `hops` and `hopStream`, which
calculate "social graph distances" from you to other peers.

And there are low-level social graph APIs such as `graph` and `graphStream`
which just tell you the latest edges in the social graph, without calculating
distances.

### `ssb.friends.follow(feedId, opts, cb)` ("async" muxrpc API)

Publishes a contact message asserting your current following state for `feedId`.

`opts` must be an object (or `null`) with these (optional) properties:

- `state` *Boolean* - whether you are asserting (`true`) or undoing (`false`) a
follow. (Default: `true`)
- `recps` *Array* - an array of feed IDs of recipients in case you want to
publish this contact message privately to some feeds / groups (see e.g.
`ssb-tribes`)

### `ssb.friends.block(feedId, opts, cb)` ("async" muxrpc API)

Publishes a contact message asserting your current blocking state for `feedId`.

`opts` must be an object (or `null`) with these (optional) properties:

- `state` *Boolean* - whether you are asserting (`true`) or undoing (`false`) a
block. (Default: `true`)
- `reason` *String* - a description about why you're blocking (or unblocking)
this peer
- `recps` *Array* - an array of feed IDs of recipients in case you want to
publish this contact message privately to some feeds / groups (see e.g.
`ssb-tribes`)

### `ssb.friends.isFollowing(opts, cb)` ("async" muxrpc API)

Calls back `true` if `opts.source` follows `opts.dest`, `false` otherwise, where
`opts.source` and `opts.dest` are strings of SSB Feed IDs.

If you pass `opts.details = true`, then the callback will respond with the
object `{ response, private }`, where `response` is the boolean indicating
the follow relationship, and `private` is a boolean indicating that the
relationship was originally encoded in a private (encrypted) message.

### `ssb.friends.isBlocking(opts, cb)` ("async" muxrpc API)

Calls back `true` if `opts.source` blocks `opts.dest`, `false` otherwise, where
`opts.source` and `opts.dest` are strings of SSB Feed IDs.

If you pass `opts.details = true`, then the callback will respond with the
object `{ response, private }`, where `response` is the boolean indicating
the block relationship, and `private` is a boolean indicating that the
relationship was originally encoded in a private (encrypted) message.

### `ssb.friends.hops([opts,] cb)` ("async" muxrpc API)

Retrieves the current hops state, which is an object of the shape

```
{
  FeedId1: distance, // distance from you in hops
  FeedId2: distance,
  FeedId3: distance,
}
```

(**Advanced**) `opts` is an optional object, which allows you to configure the
calculation of the hops distances with the following object fields:

- `opts.start` *String* - feed ID of the "central" node where distance is zero.
(Default: `sbot.id`)
- `opts.max` *Number* - a max distance, where nodes beyond this distance are
omitted from the output. If the max is equal to or less than the default
(`config.friends.hops`), the output will be faster to calculate, because it will
just copy the cached value, but skip nodes at a greater distance than max.
(Default: `config.friends.hops` or 3)
- `opts.reverse` *Boolean* - when `true`, the output is the hops distance **to*
`opts.start`, instead of **from** `opts.start`. (Default: `false`)

### `ssb.friends.hopStream([opts])` ("source" muxrpc API)

Return a stream of hops objects `{<id>:<dist>,...}`, where the first item is the
current state (such as what `ssb.friends.hops()` returns), and any following
objects are updates caused by someone in your network following, unfollowing or
blocking someone.

Can be configured via an `opts` argument, although arguably *less* configurable
than `ssb.friends.hops()` because it only supports the following fields:

- `opts.old` *Boolean* - whether or not to include the current state (such as
what `ssb.friends.hops()` returns). (Default: `false`)
- `opts.live` *Boolean* - whether or not to include subsequent updates.
(Default: `true`)

### `ssb.friends.graph(cb)` ("async" muxrpc API)

Retrieves the current state of the social graph, which is an object of the shape

```
{
  FeedId1: {
    FeedId2: value, // a weight for the edge FeedId1 => FeedId2
  },
  FeedId3: {
    FeedId4: value,
    FeedId5: value,
  },
}
```

The `value` is a number, where its meaning is described at the top of this
README.

### `ssb.friends.graphStream([opts])` ("source" muxrpc API)

Returns a stream of social graph objects, where each object has the same shape as the output of `ssb.friends.graph()`. The first object in the stream (only if `opts.old` is true) reflects the current state of the social graph, and subsequent objects (only if `opts.live` is true) represent just one updated edge, in the shape `{ FeedId1: { FeedId2: value } }`.

- `opts.old` *Boolean* - whether or not to include the current state (such as
what `ssb.friends.graph()` returns). (Default: `false`)
- `opts.live` *Boolean* - whether or not to include subsequent updates of edges
in the social graph.
(Default: `true`)

## Edge weights

This module is implemented in terms of [dynamic-dijkstra](https://github.com/dominictarr/dynamic-dijkstra)
(via [layered-graph](https://github.com/ssbc/layered-graph)).

Relations between feeds are represented as non-zero numbers, as follows:

In SSB we use `1` to represent a follow, `-1` to represent a block, `-2` to
represent unfollow.

A feed with distance `2` is a "friend of a friend" (we follow someone `+1`
who follows them `+1` which sums up as `2`). The distance `-2` can mean either
blocked by a friend or unfollowed by us.

If a friend follows someone another friend blocks, the friends follow wins,
but if you block them directly, that block wins over the friend's follow.

## License

MIT
