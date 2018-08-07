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

This enables plugins to provide different views on feed relationships, and then combine them together.

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



