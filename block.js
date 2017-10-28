
exports.initial = [0]

function isEqual (a,b) {
  return a[0] == b[0] && a[1] == b[1]
}

function isFollowing (a) {
  if(a[1] == null) return a[0] != null
  if(a[0] == null) return false
  return a[0] < a[1]
}

function isCloser(then, now) {
  if(then[0] != null && now[0] != null && now[0] < then[0])
    return true
}

exports.update = function (then, now) {
//  if(now[0] === 0) return true //this is us
  if(isFollowing(now) != isFollowing(then)) return true
  if(isCloser(then, now)) return true
  return false
//  return isCloser(then, now) || isFollowing(then) != isFollowing(now)
}

function min (a, b) {
  return Math.min(
    a == null ? Number.POSITIVE_INFINITY : a,
    b == null ? Number.POSITIVE_INFINITY : b
  )
}

exports.reduce = function (target, source, value) {
  target = target || []
  var frenemy = source[0] === source[1]
  //track the min hop followed from, and blocked from

  if(value === true && !frenemy) {
    return [min(target[0], source[0]+1), target[1]]
  }
  else if(frenemy) {
    return target.length ? target : null
  }
  else if(value === false) {
    return [target[0], min(target[1], source[0]+1)]
  }
  return target
}

exports.expand = function (value) {
  if(!value || value[0] == null) return false
  if(value[0] != null) //followed before blocked
    if(null == value[1]) return true
    //expand if we followed directly
    else if(value[0] < value[1]) return true

  return false
}

exports.isWanted = function (target) {
  if(target[0] == null) return false
  if(target[1] == null) return target[0] >= 0
  return target[0] <= target[1]
}



