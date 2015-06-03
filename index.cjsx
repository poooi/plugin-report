{_} = window
Promise = require 'bluebird'
async = Promise.coroutine
request = Promise.promisifyAll require 'request'
## ## CreateShip ## ##
creating = false
kdockId = -1
detail =
  item: []
  highspeed: []
  kdockId: -1
  largeFlag: false
  secretary: -1
  shipId: -1
## ## ## ## ## ## ## ##
window.addEventListener 'game.response', async (e) ->
  {method, path, body, postBody} = e.detail
  {_ships, _decks} = window
  switch path
    when '/kcsapi/api_req_kousyou/createship'
      creating = true
      kdockId = parseInt(postBody.api_kdock_id) - 1
      secretaryIdx = _.sortedIndex _ships, {api_id: _decks[0].api_ship[0]}, 'api_id'
      detail =
        item: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4), parseInt(postBody.api_item5)]
        kdockId: kdockId
        largeFlag: (parseInt(postBody.api_large_flag) != 0)
        highspeed: parseInt(postBody.api_highspeed)
        secretary: _ships[secretaryIdx].api_ship_id
        shipId: -1
    when '/kcsapi/api_get_member/kdock'
      return unless creating
      dock = body[kdockId]
      return if dock.api_item1 != detail.item[0] || dock.api_item2 != detail.item[1] || dock.api_item3 != detail.item[2] || dock.api_item4 != detail.item[3] || dock.api_item5 != detail.item[4]
      detail.shipId = api_created_ship_id
      creating = false
      try
        yield request.postAsync
          url: 'http://poi.0u0.moe/api/report/create_ship'
          form:
            data: JSON.stringify detail
      catch e
        console.error e
    when '/kcsapi/api_req_sortie/battleresult'
      try
        yield request.postAsync
          url: 'http://poi.0u0.moe/api/report/drop_ship'
          form:
            data: body.api_get_ship.api_ship_id
      catch e
        console.error e
module.exports =
  name: 'Reporter'
  displayName: '数据汇报'
  description: '汇报建造数据、海域掉落数据'
  show: false
  version: '1.0.0'
