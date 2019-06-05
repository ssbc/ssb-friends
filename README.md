# ssb-friends

The logic of who to replicate in ssb.

based on [dynamic-dijkstra](https://github.com/dominictarr/dynamic-dijkstra) module,
see that readme to see in depth discussion of the algorithm.

the relation between any two peers can be in 3 states.
following, not following, and blocking.


* _following_ means you will definitely replicate them.
* _not following_ means you might not replicate them,
but you might replicate them if your friend follows them.
* _blocking_ means that you will not replicate them.
  if they are blocked by someone you follow, and you are not following them, then you will not replicate them.
* if a friend of blocks someone, they will not be replicated, unless another friend follows them.
* if one friend blocks, and another follows, they will be replicated
  but their friends won't be (this is to stop sybil swarms)


## api

this comes built into scuttlebot by default, you are probably using this api by writing a client
app or using sbot from a cli tool.

> Note: synchronous methods called over a `ssb-client` connection are converted into asynchronous methods (a callback is added as the final argument which will be called back with the result)

<!-- TODO expose this as api? (collides with legacy get)
### getRaw (cb)

get the current state of the graph. it is of the form:

```
{
  <alice_id>: {<bob_id>:<dist>,...},...
}

```

where `<dist>` is a non-zero number. (negative indicates blocking).
a value of 1 < 1.5 is considered to mean "follows" and 0 < 0.5 is considered to mean "same as"
-->
### hopStream () => Source

return a stream of hops objects `{<id>:<dist>,...}`, the first item is the current state,
any following objects are updates caused by someone in your network following, unfollowing or blocking someone.

### onEdge (fn) => removeListener

subscribe to changes in the graph.
This can only be called locally by another in-process scuttlebot plugin.

### hops (cb)

retrive the current hops.

### isFollowing({source, dest}, cb)

callsback true if `source` follows `dest`, false otherwise.

### isBlocking({source, dest}, cb)

callsback true if `source` blocks `dest`, false otherwise.

### createLayer(name)

Create a layer with `name`, this feature is exposed from [layered-graph](https://github.com/dominictarr/layered-graph)

This enables plugins to provide different views on feed relationships, and then combine them together. This method is not available remotely (over RPC).

As an example, here is code to make a view that only track old-style pub follows.

``` js
  var layer = sbot.friends.createLayer('pubs')
  var init = false //keep track of wether we have initialized the layer.

  var view = sbot._flumeUse('pubs', Reduce(1, function (g, data) {
    g = g || {}
    var content = data.value.content
    if(
      content.type === 'contact' &&
      isFeed(content.contact) &&
      content.following === true &&
      (content.autofollow === true || content.pub === true)
    ) {
      var from = data.value.author, to = content.contact
      g[from] = g[from] || {}
      g[from][to] = 1
      //updating an edge in the layer should be handled within the view reduce function,
      //but only after it has been initialized.
      if(init) layer(from, to, 1)
    }
    return g
  })

  //if we call view.get like this, it will delay until this view is in sync with the main log.
  //
  view.get(function (err, value) {
    init = true
    layer(value)
  })

```

## dynamic dijkstra

Since version 3, this module is now implemented in terms of [dynamic-dijkstra](https://github.com/dominictarr/dynamic-dijkstra) (via [layered-graph](https://github.com/ssbc/layered-graph)).
DD is about traversing graphs that have real time updates.

Relations between feeds are represented as non-zero numbers, as follows:

In ssb we use 1 to represent follow, -1 to represent block, -2 to represent unfollow, and 0.1
to represent "same-as". A feed with path length 2 is a "friend of a friend" (we follow someone +1
who follows them + 1 = 2). If you block someone, that is -1. so -2 can mean blocked by a friend or unfollowed.
min defines a positive length to be less than the negative length with the same absolute value,
`min(-n, n) == n` so if a friend follows someone another friend blocks, the friends follow wins,
(but if you block them directly, that block wins over the friend's follow)

`expand(length, max)` return false if `length < 0`, or `length > max`.

`isAdd(v)` returns true if `v >= 0`

same-as is represented by very low weights (i.e. `0.1`)  to link two devices `a, b` together,
we have edges `a->b` and `b->a`. Low weights can also be used for delegation.
Say, a blocklist `l` can be implemented as a node that only blocks, then someone `x` subscribes
to that blocklist by adding edge `x->l` with a weight of `0.1`.



## legacy apis

The following apis are intended to be backwards compatible with earlier versions of ssb-friends.
They will hopefully be removed once clients have had a chance to update. It's recommended to
use the non-legacy apis for new software. Also, the new graph data structure has a decimal
edge weighting, but these apis return boolean (true = follow or same-as, false = block, null = unfollow)

### get ({source?, dest?}, cb)

get the follow graph, or a portion of the follow graph. If neither `source` or `dest` are provided,
the full follow graph will be returned. If `source` is provided, the result will be the map
of all feeds that the source has relationship edges to (including follow and block), if only
`dest` is provided, the result will be the same form, but it will represent feeds that follow the `dest`.
If _both_ `source` and `dest` are provided, the result will be a single value: true if `source` follows `dest`, false if they are blocked, or null if they do not follow (or have unfollowed)

### createFriendStream ({meta, live, old}) => Source

returns a source stream of the hops. if `meta` is true,
each item is in the form `{id: <id>, hops: <hops>}`, otherwise, each item is just the `<id>`.
if `old` is false, current values will not be streamed. If live is true, the stream will stay open
but do nothing until hops changes due to the addition of new edges.

### stream ({live, old})

Create a stream of changes to the graph.
The first item is the graph structure
`{<id>: {<id>: <value>,...}, ...}`

The rest of the values are real time changes, of the form `{from: <id>, to: <id>, value: <value>}`
value is a boolean or null, as with the other legacy apis.

> note: I am considering a graph stream api were the rest are the same form as the graph structure,
and merging those objects gets the updated graph. for a single edge `<from>-><to>`
it would look like `{<from>: {<to>: <value>}}`

## License

MIT




