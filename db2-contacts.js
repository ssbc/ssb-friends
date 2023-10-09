const bipf = require('bipf')
const pull = require('pull-stream')
const pl = require('pull-level')
const Plugin = require('ssb-db2/indexes/plugin')
const isFeed = require('ssb-ref').isFeed

const bValue = Buffer.from('value')
const bAuthor = Buffer.from('author')
const bContent = Buffer.from('content')
const bType = Buffer.from('type')
const bContact = Buffer.from('contact')

module.exports = function (createLayer) {
  return class Friends extends Plugin {
    constructor (log, dir) {
      super(log, dir, 'contacts', 2, undefined, 'json')
      this.layer = createLayer('contacts')
      this.layer({})

      // used for dictionary compression where a feed is mapped to its index
      this.feeds = []

      // a map of feed -> { feed: followStatus }
      this.feedValues = {}
      // assuming we have feed A (index 0) and B, and A follows B we will in feedValues store:
      // { 0: { 1: 1 } } meaning the map of values for feed A (0) is: index 1 (B) has value 1 (follow)
      //
      // feeds will be: [A,B] in this example

      // it turns out that if you place the same key in a batch multiple
      // times. Level will happily write that key as many times as you give
      // it, instead of just writing the last value for the key, so we have
      // to help the poor bugger
      this.batchKeys = {} // key to index
    }

    onFlush (cb) {
      this.batchKeys = {}
      cb()
    }

    processRecord (record, seq) {
      const recBuffer = record.value
      if (!recBuffer) return // deleted

      let p = 0 // note you pass in p!
      p = bipf.seekKey(recBuffer, p, bValue)
      if (p < 0) return

      const pAuthor = bipf.seekKey(recBuffer, p, bAuthor)
      const author = bipf.decode(recBuffer, pAuthor)

      const pContent = bipf.seekKey(recBuffer, p, bContent)
      if (pContent < 0) return

      const pType = bipf.seekKey(recBuffer, pContent, bType)
      if (pType < 0) return

      if (bipf.compareString(recBuffer, pType, bContact) === 0) {
        const content = bipf.decode(recBuffer, pContent)
        const to = content.contact

        if (isFeed(author) && isFeed(to)) {
          const value = content.blocking || content.flagged
            ? -1
            : content.following === true
              ? 1
              : -2

          let updateFeeds = false

          let fromIndex = this.feeds.indexOf(author)
          if (fromIndex === -1) {
            this.feeds.push(author)
            fromIndex = this.feeds.length - 1
            updateFeeds = true
          }

          let toIndex = this.feeds.indexOf(to)
          if (toIndex === -1) {
            this.feeds.push(to)
            toIndex = this.feeds.length - 1
            updateFeeds = true
          }

          const fromValues = this.feedValues[fromIndex] || {}
          fromValues[toIndex] = value
          this.feedValues[fromIndex] = fromValues

          const batchValue = {
            type: 'put',
            key: fromIndex,
            value: fromValues
          }

          const existingKeyIndex = this.batchKeys[fromIndex]
          if (existingKeyIndex) {
            this.batch[existingKeyIndex] = batchValue
          } else {
            this.batch.push(batchValue)
            this.batchKeys[fromIndex] = this.batch.length - 1
          }

          if (updateFeeds) {
            const feedsValue = {
              type: 'put',
              key: 'feeds',
              value: this.feeds
            }

            const existingFeedsIndex = this.batchKeys.feeds
            if (existingFeedsIndex) {
              this.batch[existingFeedsIndex] = feedsValue
            } else {
              this.batch.push(feedsValue)
              this.batchKeys.feeds = this.batch.length - 1
            }
          }

          this.layer(author, to, value)
        }
      }
    }

    onLoaded (cb) {
      pull(
        pl.read(this.level, {
          valueEncoding: this.valueEncoding,
          keys: true
        }),
        pull.collect((err, data) => {
          if (err) return cb(err)

          for (let i = 0; i < data.length; ++i) {
            if (data[i].key === 'feeds') {
              this.feeds = data[i].value
              break
            }
          }

          const result = {}
          for (let i = 0; i < data.length; ++i) {
            const relation = data[i]

            if (relation.key !== '\x00' && relation.key !== 'feeds') {
              const feedIndex = parseInt(relation.key, 10)
              const feed = this.feeds[feedIndex]
              const feedFollowStatus = result[feed] || {}
              const feedIndexValues = this.feedValues[feedIndex] || {}

              const valueKeys = Object.keys(relation.value)
              for (let v = 0; v < valueKeys.length; ++v) {
                const toIndex = valueKeys[v]
                const to = this.feeds[toIndex]
                const value = parseInt(relation.value[valueKeys[v]], 10)
                feedIndexValues[toIndex] = feedFollowStatus[to] = value
              }

              result[feed] = feedFollowStatus
              this.feedValues[feedIndex] = feedIndexValues
            }
          }

          this.layer(result)
          cb()
        })
      )
    }
  }
}
