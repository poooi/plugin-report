{_, SERVER_HOSTNAME} = window
Promise = require 'bluebird'
async = Promise.coroutine
request = Promise.promisifyAll require 'request'
## ## CreateShip ## ##
creating = false
kdockId = -1
detail =
  items: []
  highspeed: -1
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
        items: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4), parseInt(postBody.api_item5)]
        kdockId: kdockId
        largeFlag: (parseInt(postBody.api_large_flag) != 0)
        highspeed: parseInt(postBody.api_highspeed)
        secretary: _ships[secretaryIdx].api_ship_id
        shipId: -1
    when '/kcsapi/api_get_member/kdock'
      return unless creating
      dock = body[kdockId]
      return if dock.api_item1 != detail.items[0] || dock.api_item2 != detail.items[1] || dock.api_item3 != detail.items[2] || dock.api_item4 != detail.items[3] || dock.api_item5 != detail.items[4]
      detail.shipId = dock.api_created_ship_id
      creating = false
      try
        yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/create_ship",
          form:
            data: JSON.stringify detail
      catch e
        console.error e
    when '/kcsapi/api_req_sortie/battleresult'
      info =
        shipId: -1
        quest: body.api_quest_name
        enemy: body.api_enemy_info.api_deck_name
        rank: body.api_win_rank
      if body.api_get_ship?
        info.shipId = body.api_get_ship.api_ship_id
      try
        yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/drop_ship",
          form:
            data: JSON.stringify info
      catch e
        console.error e
module.exports =
  name: 'Reporter'
  displayName: '数据汇报'
  description: '汇报建造数据、海域掉落数据'
  show: false
  version: '1.0.0'
