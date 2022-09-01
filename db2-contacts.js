const bipf = require('bipf')
const pull = require('pull-stream')
const pl = require('pull-level')
const Plugin = require('ssb-db2/indexes/plugin')
const isFeed = require('ssb-ref').isFeed

const BIPF_META = bipf.allocAndEncode('meta')
const BIPF_PRIVATE = bipf.allocAndEncode('private')
const BIPF_AUTHOR = bipf.allocAndEncode('author')
const BIPF_CONTENT = bipf.allocAndEncode('content')
const BIPF_TYPE = bipf.allocAndEncode('type')

const B_CONTACT = Buffer.from('contact')

// This index has the following key/values:
//
// sourceIdx => { [destIdx1]: edgeValue, [destIdx2]: edgeValue, ... }
// "feeds" => [feedAIdx, feedBIdx, feedCIdx, ...]
//
// If the edge is private (from an encrypted contact msg), then the `edgeValue`
// is a string prefixed with "p", e.g. a private block is the string `"p-1"`,
// while a public block is just `"-1"`
module.exports = function db2Contacts (createLayer, resetLayers) {
  return class Friends extends Plugin {
    constructor (log, dir) {
      super(log, dir, 'contacts', 3, undefined, 'json')
      this.updatePublicLayer = createLayer('contactsPublic')
      this.updatePublicLayer({})
      this.updatePrivateLayer = createLayer('contactsPrivate')
      this.updatePrivateLayer({})

      // used for dictionary compression where a feed is mapped to its index
      this.feeds = []
      // mapping from feed -> index in feeds array
      this.feedsIndex = {}

      // a map of sourceIdx => { [destIdx1]: edgeValue, ... }
      this.edges = {}
      // assuming we have feed A (index 0) and B (index 1), and A follows B,
      // then `this.edges` looks like `{ 0: { 1: 1 } }`, meaning that feed A (0)
      // has an edge pointing to feed B (1) with value 1 (follow)
      //
      // `this.feeds` will be: [A,B] in this example

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

    reset() {
      resetLayers()
      this.updatePublicLayer = createLayer('contactsPublic')
      this.updatePublicLayer({})
      this.updatePrivateLayer = createLayer('contactsPrivate')
      this.updatePrivateLayer({})
      this.feeds = []
      this.feedsIndex = {}
      this.edges = {}
      this.batchKeys = {}
    }

    isPrivateRecord (recBuffer) {
      const pMeta = bipf.seekKey2(recBuffer, 0, BIPF_META, 0)
      if (pMeta < 0) return false
      const pPrivate = bipf.seekKey2(recBuffer, pMeta, BIPF_PRIVATE, 0)
      if (pPrivate < 0) return false
      const isPrivate = bipf.decode(recBuffer, pPrivate)
      return isPrivate
    }

    processRecord (record, seq, pValue) {
      const recBuffer = record.value
      if (!recBuffer) return // deleted

      const pContent = bipf.seekKey2(recBuffer, pValue, BIPF_CONTENT, 0)
      if (pContent < 0) return

      const pType = bipf.seekKey2(recBuffer, pContent, BIPF_TYPE, 0)
      if (pType < 0) return

      if (bipf.compareString(recBuffer, pType, B_CONTACT) === 0) {
        const pAuthor = bipf.seekKey2(recBuffer, pValue, BIPF_AUTHOR, 0)
        const source = bipf.decode(recBuffer, pAuthor)
        const content = bipf.decode(recBuffer, pContent)
        const dest = content.contact

        if (isFeed(source) && isFeed(dest)) {
          const privately = this.isPrivateRecord(recBuffer)

          const edgeValue = content.blocking || content.flagged
            ? -1
            : content.following === true
              ? 1
              : -2

          let updateFeeds = false

          let sourceIdx = this.feedsIndex[source]
          if (sourceIdx === undefined) {
            this.feeds.push(source)
            sourceIdx = this.feeds.length - 1
            this.feedsIndex[source] = sourceIdx
            updateFeeds = true
          }

          let destIdx = this.feedsIndex[dest]
          if (destIdx === undefined) {
            this.feeds.push(dest)
            destIdx = this.feeds.length - 1
            this.feedsIndex[dest] = destIdx
            updateFeeds = true
          }

          const sourceEdges = this.edges[sourceIdx] || {}
          if (privately) {
            sourceEdges[destIdx] = 'p' + edgeValue
          } else {
            sourceEdges[destIdx] = edgeValue
          }
          this.edges[sourceIdx] = sourceEdges

          const edgeEntry = {
            type: 'put',
            key: sourceIdx,
            value: sourceEdges
          }

          const existingKeyIndex = this.batchKeys[sourceIdx]
          if (existingKeyIndex) {
            this.batch[existingKeyIndex] = edgeEntry
          } else {
            this.batch.push(edgeEntry)
            this.batchKeys[sourceIdx] = this.batch.length - 1
          }

          if (updateFeeds) {
            const feedsEntry = {
              type: 'put',
              key: 'feeds',
              value: this.feeds
            }

            const existingFeedsIndex = this.batchKeys.feeds
            if (existingFeedsIndex) {
              this.batch[existingFeedsIndex] = feedsEntry
            } else {
              this.batch.push(feedsEntry)
              this.batchKeys.feeds = this.batch.length - 1
            }
          }

          if (privately) {
            this.updatePrivateLayer(source, dest, edgeValue)
          } else {
            this.updatePublicLayer(source, dest, edgeValue)
          }
        }
      }
    }

    onLoaded (cb) {
      pull(
        pl.read(this.level, {
          valueEncoding: this.valueEncoding,
          keys: true
        }),
        pull.collect((err, entries) => {
          if (err) return cb(err)

          for (let i = 0; i < entries.length; ++i) {
            if (entries[i].key === 'feeds') {
              this.feeds = entries[i].value
              for (var fIdx = 0; fIdx < this.feeds.length; ++fIdx) {
                const feed = this.feeds[fIdx]
                this.feedsIndex[feed] = fIdx
              }
              break
            }
          }

          const publicLayer = {}
          const privateLayer = {}
          for (let i = 0; i < entries.length; ++i) {
            const entry = entries[i]

            if (entry.key !== '\x00' && entry.key !== 'feeds') {
              const sourceIdx = parseInt(entry.key, 10)
              const source = this.feeds[sourceIdx]
              const publicLayerEdges = publicLayer[source] || {}
              const privateLayerEdges = privateLayer[source] || {}
              const sourceEdges = this.edges[sourceIdx] || {}

              const destIdxs = Object.keys(entry.value)
              for (let v = 0; v < destIdxs.length; ++v) {
                const destIdx = destIdxs[v]
                const dest = this.feeds[destIdx]
                const rawEdgeValue = entry.value[destIdx]
                const privately = rawEdgeValue[0] === 'p'
                const edgeValue = privately
                  ? parseInt(rawEdgeValue.slice(1), 10)
                  : parseInt(rawEdgeValue, 10)
                if (privately) {
                  privateLayerEdges[dest] = edgeValue
                } else {
                  publicLayerEdges[dest] = edgeValue
                }
                sourceEdges[destIdx] = rawEdgeValue
              }

              publicLayer[source] = publicLayerEdges
              privateLayer[source] = privateLayerEdges
              this.edges[sourceIdx] = sourceEdges
            }
          }

          this.updatePublicLayer(publicLayer)
          this.updatePrivateLayer(privateLayer)
          cb()
        })
      )
    }
  }
}
