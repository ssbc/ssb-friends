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
  var queue = [start]
  while(queue.length) {
    var cursor = queue.shift()
    var value = visited[cursor]
    for(var k in graph[cursor]) {
      var v = graph[cursor][k]
      var previous = visited[k]
      var value = opts.reduce(visited[k], visited[cursor], v)
      if(value != null) {
        visited[k] = value
      }
      if(opts.expand(visited[k]) && previous == null)
          queue.push(k)
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
