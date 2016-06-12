{_, SERVER_HOSTNAME} = window
Promise = require 'bluebird'
async = Promise.coroutine
request = Promise.promisifyAll require 'request'
path = require 'path-extra'
REPORTER_VERSION = '2.4.0'

__ = window.i18n["poi-plugin-report"].__.bind(window.i18n["poi-plugin-report"])

# Quest
knownQuests = []
questReportEnabled = false
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
# Remodel item
remodelItemId = -1
remodelItemLevel = -1

reportToServer = async (e) ->
    {method, path, body, postBody} = e.detail
    {_ships, _decks, _teitokuLv} = window
    switch path
      # Quest detail
      when '/kcsapi/api_get_member/questlist'
        if body.api_list?
          for quest in body.api_list
            continue unless questReportEnabled
            continue if quest == -1
            continue if _.indexOf(knownQuests, quest.api_no, true) != -1
            info =
              questId: quest.api_no
              title: quest.api_title
              detail: quest.api_detail
              category: quest.api_category
              type: quest.api_type
            knownQuests.push quest.api_no
            knownQuests.sort()
            try
              yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/quest/#{quest.api_no}",
                form:
                  data: JSON.stringify info
                headers:
                  'User-Agent': "Reporter v#{REPORTER_VERSION}"
            catch err
              console.error err
      # Map selected rank
      when '/kcsapi/api_get_member/mapinfo'
        for map in body
          mapLv[map.api_id] = 0
          if map.api_eventmap?
            mapLv[map.api_id] = map.api_eventmap.api_selected_rank
      # Eventmap select report
      when '/kcsapi/api_req_map/select_eventmap_rank'
        {_teitokuLv, _teitokuId} = window
        info =
          teitokuLv: _teitokuLv
          teitokuId: _teitokuId
          mapareaId: parseInt(postBody.api_maparea_id) * 10 + parseInt(postBody.api_map_no)
          rank: parseInt(postBody.api_rank)
        mapLv[parseInt(postBody.api_maparea_id) * 10 + parseInt(postBody.api_map_no)] = parseInt(postBody.api_rank)
        try
          yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/select_rank",
            form:
              data: JSON.stringify info
            headers:
              'User-Agent': "Reporter v#{REPORTER_VERSION}"
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
              'User-Agent': "Reporter v#{REPORTER_VERSION}"
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
              'User-Agent': "Reporter v#{REPORTER_VERSION}"
        catch err
          console.error err
      # Remodel item report
      when '/kcsapi/api_req_kousyou/remodel_slotlist_detail'
        remodelItemId = postBody.api_slot_id
        remodelItemLevel = _slotitems[remodelItemId].api_level
      when '/kcsapi/api_req_kousyou/remodel_slot'
        if remodelItemId != postBody.api_slot_id
          console.error 'Inconsistent remodel item data: #{remodelItemId}, #{postBody.api_slot_id}'
          return
        flagship = _ships[_decks[0].api_ship[0]]
        consort  = _ships[_decks[0].api_ship[1]]
        info =
          successful: body.api_remodel_flag
          itemId: body.api_remodel_id[0]
          itemLevel: remodelItemLevel
          flagshipId: flagship.api_ship_id
          flagshipLevel: flagship.api_lv
          flagshipCond: flagship.api_cond
          consortId: consort.api_ship_id
          consortLevel: consort.api_lv
          consortCond: consort.api_cond
          teitokuLv: _teitokuLv
        try
          yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/remodel_item",
            form:
              data: JSON.stringify info
            headers:
              'User-Agent': "Reporter v#{REPORTER_VERSION}"
        catch err
          console.error err
  # Drop ship report
reportBattleResultToServer = async (e) ->
    {rank, boss, map, mapCell, quest, enemy, dropShipId, enemyShipId, enemyFormation, getEventItem} = e.detail
    {_teitokuLv, _nickName, _teitokuId} = window
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
          'User-Agent': "Reporter v#{REPORTER_VERSION}"
    catch err
      console.error err
    if getEventItem
      info =
        teitokuId: _teitokuId
        teitokuLv: _teitokuLv
        teitoku: _nickName
        mapId: map
        mapLv: mapLv[map] or 0
      try
        yield request.postAsync "http://#{SERVER_HOSTNAME}/api/report/v2/pass_event",
          form:
            data: JSON.stringify info
          headers:
            'User-Agent': "Reporter v#{REPORTER_VERSION}"
      catch err
        console.error err

module.exports =
  show: false
  pluginDidLoad: (e) ->
    # Game listener
    request.get "http://#{SERVER_HOSTNAME}/api/report/v2/known_quests", (err, response, body) ->
      return if err? || response.statusCode != 200
      knownQuests = JSON.parse(body).quests
      questReportEnabled = true
    window.addEventListener 'game.response', reportToServer
    window.addEventListener 'battle.result', reportBattleResultToServer
  pluginWillUnload: (e) ->
    window.removeEventListener 'game.response', reportToServer
    window.removeEventListener 'battle.result', reportBattleResultToServer
