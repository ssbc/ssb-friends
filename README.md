# ssb-friends2

rethinking the "friends" algorithms for secure scuttlebutt.

## requirements

ability to express the following types of relationships.

* A is follower of B. (A replicates B's data, and advertises that they do, essentially recommending
* B to their own followers. This implies that A may replicate B's follows too.)
* A is the same as A' (A has a second device A', which also should be considered A)
* A can choose to follow B, but not replicate their follows.
* A can block B (does not replicate B at all, asks that their messages are not provided to B)

## data structure

``` js
{
  hops: 2, //the local peer's hop's policy: how far out do they replicate
  id: 'A', //your id
  follows: {
    A: {
      B: 1, //A follows B.
      A1: 0, //A is same-as A'
      C: 2, //explicitly consider C to be 2 hops from A.
      D: [1, 2] //consider D to be followed at one hops, but consider their follows to be 3 hops away.
      A2: [0, 2] //replicate A as same as, but do consider their follows to be 2 hops out.
    },
    B: {
      A: 1, C: 1
    },
    C: {
      E: 1
    },
    D: {
      E: 1
    },
    A1: {
      A: 0, //A' is also same-as A. *
    }
  },
  //blocks is the other way around.
  //blockee <- blocker
  //because usually we what to quickly know who has blocked the blockee,
  //not the other way around.
  blocked: {
    B: {D: true} //B is blocked by D.
  }
}
```

the above data structure will convert to this hops map:

``` js
{
  A: 0, A': 0, A": 0, //our various devices
  B: 1,
  C: 2, //2 hops, via explicit and C
  D: 1,
  //E not in range, since 2 hops from D and 1 from C.
}
```

## Notes

It is possible for the data structure to represent a _one-way same-as_,
by having `A: {A': 0}` but not `A':{A:0}`. although I do not anticipate this is actually useful.

you can represent follows as being close or distant. `{B:1}` means B is considered 1 hop away.
`B:2` means B is considered 2 hops. Any non-negative number can be used. Including decimals,
although I'm not sure if that is actually useful.

If the array form is used `C: [incoming, outgoing]` that means C is considered `incoming` hops away,
but their follows are considered `outgoing` extra hops. Normally `outgoing` would be a larger number
than `incoming`.

If D is blocked by A, then A does not replicate D. The blocked relation is represented
in the reverse to to follows, this is because we generally want to query this the other way around.
For example, when traversing the follows graph, we want to check if anyone blocks someone
before we traverse them. If they are blocked by who is 0 hops from us (i.e. any of our devices)
then do not replicate them. Otherwise, if they are closer to someone who blocks them than
someone who follows them then do not expand their follows. (example: if they are a foaf
but also a friend blocks them)


## License

MIT

