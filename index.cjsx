{_, SERVER_HOSTNAME} = window
Promise = require 'bluebird'
async = Promise.coroutine
request = Promise.promisifyAll require 'request'

if config.get('plugin.ShipInfo.enable', true)
  # Map lv record
  mapLv = []
  # Create ship record
  creating = false
  kdockId = -1
  detail =
    items: []
    highspeed: -1
    kdockId: -1
    largeFlag: false
    secretary: -1
    shipId: -1
  # Game listener
  ### TODO Add event map level ###
  window.addEventListener 'game.response', async (e) ->
    {method, path, body, postBody} = e.detail
    {_ships, _decks, _teitokuLv} = window
    switch path
      # Map selected rank
      when '/kcsapi/api_get_member/mapinfo'
        for map in body
          mapLv[map.api_id] = 0
          if map.api_eventmap?
            mapLv[map.api_id] = map.api_eventmap.api_selected_rank
      # Eventmap select report
      when '/kcsapi/api_req_map/select_eventmap_rank'
        {_teitokuLv, _nickNameId} = window
        info =
          teitokuLv: _teitokuLv
          teitokuId: _nickNameId
          mapareaId: parseInt(postBody.api_maparea_id) * 10 + parseInt(postBody.api_map_no)
          rank: parseInt(postBody.api_rank)
        mapLv[parseInt(postBody.api_maparea_id) * 10 + parseInt(postBody.api_map_no)] = parseInt(postBody.api_rank)
        try
          yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/select_rank",
            form:
              data: JSON.stringify info
            headers:
              'User-Agent': 'Reporter v2.1.0'
        catch err
          console.error err
      # Create ship report
      when '/kcsapi/api_req_kousyou/createship'
        creating = true
        kdockId = parseInt(postBody.api_kdock_id) - 1
        secretaryIdx = _decks[0].api_ship[0]
        detail =
          items: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4), parseInt(postBody.api_item5)]
          kdockId: kdockId
          largeFlag: (parseInt(postBody.api_large_flag) != 0)
          highspeed: parseInt(postBody.api_highspeed)
          secretary: _ships[secretaryIdx].api_ship_id
          teitokuLv: _teitokuLv
          shipId: -1
      when '/kcsapi/api_get_member/kdock'
        return unless creating
        dock = body[kdockId]
        return if dock.api_item1 != detail.items[0] || dock.api_item2 != detail.items[1] || dock.api_item3 != detail.items[2] || dock.api_item4 != detail.items[3] || dock.api_item5 != detail.items[4]
        detail.shipId = dock.api_created_ship_id
        creating = false
        try
          yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/create_ship",
            form:
              data: JSON.stringify detail
            headers:
              'User-Agent': 'Reporter v2.1.0'
        catch err
          console.error err
      # Create item report
      when '/kcsapi/api_req_kousyou/createitem'
        secretaryIdx = _decks[0].api_ship[0]
        info =
          teitokuLv: _teitokuLv
          itemId: if body.api_create_flag == 1 then body.api_slot_item.api_slotitem_id else parseInt(body.api_fdata.split(',')[1])
          secretary: _ships[secretaryIdx].api_ship_id
          successful: body.api_create_flag == 1
          items: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4)]
        try
          yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/create_item",
            form:
              data: JSON.stringify info
            headers:
              'User-Agent': 'Reporter v2.1.0'
        catch err
          console.error err
  # Drop ship report
  window.addEventListener 'battle.result', async (e) ->
    {rank, boss, map, mapCell, quest, enemy, dropShipId, enemyShipId, enemyFormation} = e.detail
    {_teitokuLv} = window
    info =
      shipId: dropShipId
      quest: quest
      enemy: enemy
      rank: rank
      isBoss: boss
      mapId: map
      cellId: mapCell
      teitokuLv: _teitokuLv
      mapLv: mapLv[map] or 0
      enemyShips: enemyShipId
      enemyFormation: enemyFormation
    try
      yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/drop_ship",
        form:
          data: JSON.stringify info
        headers:
          'User-Agent': 'Reporter v2.1.0'
    catch err
      console.error err

module.exports =
  name: 'Reporter'
  author: [<a key={0} href="https://github.com/magicae">Magica</a>]
  displayName: <span><FontAwesome key={0} name='pie-chart' /> 数据汇报</span>
  description: '汇报建造数据、海域掉落数据、开发数据'
  show: false
  version: '2.1.0'
