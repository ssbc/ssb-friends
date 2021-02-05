const bipf = require('bipf')
const pull = require('pull-stream')
const pl = require('pull-level')
const jsonCodec = require('flumecodec/json')
const Plugin = require('ssb-db2/indexes/plugin')

const isFeed = require('ssb-ref').isFeed

module.exports = function (sbot, createLayer, config) {
  const layer = createLayer('contacts')

  // used for dictionary compression where a feed is mapped to its index
  let feeds = []

  // a map of feed -> { feed: followStatus }
  const feedValues = {}
  // assuming we have feed A (index 0) and B, and A follows B we will in feedValues store:
  // { 0: { 1: 1 } } meaning the map of values for feed A (0) is: index 1 (B) has value 1 (follow)
  //
  // feeds will be: [A,B] in this example

  const bValue = Buffer.from('value')
  const bAuthor = Buffer.from('author')
  const bContent = Buffer.from('content')
  const bType = Buffer.from('type')
  const bContact = Buffer.from('contact')

  const name = 'contacts'
  const { level, offset, stateLoaded, onData, writeBatch } = Plugin(
    config.path,
    name,
    2,
    handleData,
    writeData,
    beforeIndexUpdate
  )

  let batch = []
  // it turns out that if you place the same key in a batch multiple
  // times. Level will happily write that key as many times as you give
  // it, instead of just writing the last value for the key, so we have
  // to help the poor bugger
  let batchKeys = {} // key to index

  function writeData(cb) {
    level.batch(batch, { valueEncoding: 'json' }, cb)
    batch = []
    batchKeys = {}
  }

  function handleData(record, processed) {
    if (record.offset < offset.value) return batch.length
    const recBuffer = record.value
    if (!recBuffer) return batch.length // deleted

    let p = 0 // note you pass in p!
    p = bipf.seekKey(recBuffer, p, bValue)
    if (!~p) return batch.length

    const pAuthor = bipf.seekKey(recBuffer, p, bAuthor)
    const author = bipf.decode(recBuffer, pAuthor)

    const pContent = bipf.seekKey(recBuffer, p, bContent)
    if (!~pContent) return batch.length

    const pType = bipf.seekKey(recBuffer, pContent, bType)
    if (!~pType) return batch.length

    if (bipf.compareString(recBuffer, pType, bContact) === 0) {
      const content = bipf.decode(recBuffer, pContent)
      const to = content.contact

      if (isFeed(author) && isFeed(to)) {
        const value = content.blocking || content.flagged ? -1 :
              content.following === true ? 1
              : -2

        let updateFeeds = false

        let fromIndex = feeds.indexOf(author)
        if (fromIndex === -1) {
          feeds.push(author)
          fromIndex = feeds.length -1
          updateFeeds = true
        }

        let toIndex = feeds.indexOf(to)
        if (toIndex === -1) {
          feeds.push(to)
          toIndex = feeds.length -1
          updateFeeds = true
        }

        let fromValues = feedValues[fromIndex] || {}
        fromValues[toIndex] = value
        feedValues[fromIndex] = fromValues

        const batchValue = {
          type: 'put',
          key: fromIndex,
          value: fromValues
        }

        let existingKeyIndex = batchKeys[fromIndex]
        if (existingKeyIndex) {
          batch[existingKeyIndex] = batchValue
        }
        else {
          batch.push(batchValue)
          batchKeys[fromIndex] = batch.length - 1
        }

        if (updateFeeds) {
          const feedsValue = {
            type: 'put',
            key: 'feeds',
            value: feeds
          }

          let existingFeedsIndex = batchKeys['feeds']
          if (existingFeedsIndex) {
            batch[existingFeedsIndex] = feedsValue
          } else {
            batch.push(feedsValue)
            batchKeys['feeds'] = batch.length - 1
          }
        }

        layer(author, to, value)
      }
    }

    return batch.length
  }

  layer({})

  function beforeIndexUpdate(cb) {
    get((err, g) => {
      layer(g)
      cb()
    })
  }

  function get(cb) {
    pull(
      pl.read(level, {
        valueEncoding: jsonCodec,
        keys: true
      }),
      pull.collect((err, data) => {
        if (err) return cb(err)

        for (let i = 0; i < data.length; ++i) {
          if (data[i].key === 'feeds') {
            feeds = data[i].value
            break
          }
        }

        let result = {}
        for (let i = 0; i < data.length; ++i)
        {
          const relation = data[i]

          if (relation.key !== '\x00' && relation.key !== 'feeds') {
            const feed = feeds[parseInt(relation.key, 10)]
            const feedFollowStatus = result[feed] || {}
            let valueKeys = Object.keys(relation.value)
            for (var v = 0; v < valueKeys.length; ++v) {
              const to = feeds[valueKeys[v]]
              feedFollowStatus[to] = parseInt(relation.value[valueKeys[v]], 10)
            }
            result[feed] = feedFollowStatus
          }
        }

        cb(null, result)
      })
    )
  }

  sbot.db.registerIndex(() => {
    return {
      offset,
      stateLoaded,
      onData,
      writeBatch,
      name,

      remove: level.clear,
      close: level.close.bind(level)
    }
  })
}
