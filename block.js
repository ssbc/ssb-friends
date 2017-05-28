
exports.initial = [0]

exports.compare = function (a, b) {
  console.log(a,b)
  return b[0] - a[0]
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
  if(value[0] < 3) //followed before blocked
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



