
var F = require('../')
var data = require('./friends.json')
var start = Date.now()
var reach =  F.reachable(
    data,
    "@EMovhfIrFk4NihAKnRNhrfRaqIhBv1Wj8pTxJNgvCCY=.ed25519",
    require('../block')
  )
//console.log(Date.now() - start)
var names = require('./names.json')


console.log(reach)

for(var k in reach) {
  if(reach[k]<0) {
    console.log(encodeURIComponent(names[k]) || k.substring(0, 8), reach[k], k.substring(0, 8))
    for(var j in data) {
      if(data[j][k] != null)
        console.log(' ---', encodeURIComponent(names[j]), j.substring(0, 8), data[j][k])
    }
  }
}

