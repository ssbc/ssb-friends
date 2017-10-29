var G = require('graphreduce')

exports.add = function (graph, from, to, value) {
  if(value === null)
    return G.removeEdge(graph, from, to), graph
  else
    return G.addEdge(graph, from, to, value)
}

function min (a, b) {
  return Math.min(
    a || Number.POSITIVE_INFINITY,
    b || Number.POSITIVE_INFINITY
  )
}

var defaultOpts = {
  initial: 0,
  compare: function compare (a, b) {
    return a < b ? -1 : a > b ? 1 : 0
  },
  update: function (then, now) {
    return then == null && now != null || then > now
  },
  reduce: function reduce (target, source, value) {
    return min(target,
        value === false ? ~source
      : value === true ? source + 1
      : target
    )
    return target
  },
  expand: function expand (v) {
    return v != null && v >= 0 /*&& v <= 3*/
  }
}


exports.reachable = function (graph, start, opts) {
  if(!opts)
    opts = defaultOpts

  var visited = {}
  visited[start] = opts.initial

  var queue = [start];
  while(queue.length) {
    var cursor = queue.shift()
  //  var value = visited[cursor]
    for(var k in graph[cursor]) {
      var v = graph[cursor][k]
      var _value = visited[k]
      var value = opts.reduce(_value, visited[cursor], v)
      if(value != null)
        visited[k] = value
      if(opts.expand(visited[k]) && _value == null)
        queue.push(k)
    }
  }

  return visited
}

//find nodes that are now reachable after adding edge
//where graph is the updated graph (including edge)
//but reachable is the vertices reachable befor edge was added.
//this is a faster way to calculate:
//F.diff(reachable, F.reachable(graph), opts)

exports.diffReachable = function (graph, reachable, edge, opts) {
  if(!opts)
    opts = defaultOpts

  if(reachable[edge.from] == null) return {}

  var visited = {}
  var queue = [edge.to]
  var _value =
    opts.reduce(reachable[edge.to], reachable[edge.from], edge.value)

  //check if this edge doesn't change the traversability of the graph
  if(!opts.update(reachable[edge.to], _value))
    return {}
  
  visited[edge.to] = _value
  //it shouldn't really be that surprising that width first
  //is somewhat slower than depth first, since we have to keep
  //this array around (instead of just using a stack...)
  //however, I think width first is the correct implementation.
  var queue = [edge.to]
  while(queue.length) {
    var cursor = queue.shift()
    var value = visited[cursor]
    for(var k in graph[cursor]) {
      var v = graph[cursor][k] //follow, unfollow, block, etc
      var _value = reachable[k]

      var value = opts.reduce(_value, visited[cursor], v)

//      console.log(cursor, k, value, _value, opts.update(_value, value))
      if(value != null && opts.update(_value, value)) {
//        if(visited[k] < value) throw new Error('should not decrease')
        visited[k] = value
        queue.push(k)
      }
//        if(opts.expand(visited[k]) && _value == null)
//          queue.push(k)

    }
  }

  return visited
}

exports.diff = function (then, now, opts) {
  if(!opts)
    opts = defaultOpts

  var added = {}
  for(var k in now) {
    if(then[k] == null || opts.update(then[k], now[k]))
      added[k] = now[k]
  }

  for(var k in then) {
    if(now[k] == null) added[k] = null
  }
  return added
}

exports.patch = function (then, now) {
  for(var k in now)
    then[k] = now[k]
}

