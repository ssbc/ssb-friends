# ssb-friends

The logic of who to replicate in ssb.

based on graphreduce module.

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


## License

MIT

