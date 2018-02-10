import BaseReporter from './base'

export default class DropShipReporter extends BaseReporter {
  constructor() {
    super()

    this.mapLv = []
    this.drop = null
  }
  handle(method, path, body, postBody) {
    const { mapLv } = this
    const { _teitokuId, _teitokuLv, _nickName } = window
    switch(path) {
    case '/kcsapi/api_get_member/mapinfo': {
      for (const map of body.api_map_info) {
        mapLv[map.api_id] = 0
        if (map.api_eventmap != null)
          mapLv[map.api_id] = map.api_eventmap.api_selected_rank
      }
    } break
    case '/kcsapi/api_req_map/select_eventmap_rank': {
      const mapareaId = parseInt(postBody.api_maparea_id) * 10 + parseInt(postBody.api_map_no)
      const rank = parseInt(postBody.api_rank)
      mapLv[mapareaId] = parseInt(postBody.api_rank)
      // Report select map difficulty
      this.report("/api/report/v2/select_rank", {
        teitokuId: _teitokuId,
        teitokuLv: _teitokuLv,
        mapareaId: mapareaId,
        rank: rank,
      })
    } break
    case '/kcsapi/api_req_map/start':
    case '/kcsapi/api_req_map/next': {
      const drop = {
        mapId : null,
        cellId: null,
        isBoss: null,
        mapLv : null,
        enemy : null,
        enemyShips1: null,
        enemyShips2: null,
        enemyFormation: null,
        quest : null,
        rank  : null,
        shipId: null,
        itemId: null,
        teitokuLv: null,
      }
      drop.mapId  = body.api_maparea_id * 10 + body.api_mapinfo_no
      drop.cellId = body.api_no
      drop.isBoss = body.api_event_id == 5
      drop.mapLv  = mapLv[drop.mapId]
      this.drop = drop
      if (body.api_destruction_battle != null) {
        this.report('/api/report/v2/drop_ship', {
          mapId: drop.mapId,
          cellId: -1,
          isBoss: drop.isBoss,
          mapLv: drop.mapLv,
          enemy: null,
          enemyShips1: body.api_destruction_battle.api_ship_ke,
          enemyShips2: body.api_destruction_battle.api_ship_ke_combined,
          enemyFormation: (body.api_destruction_battle.api_formation || {})[1],
          quest: null,
          rank: null,
          shipId: -1,
          itemId: -1,
          teitokuLv: _teitokuLv
        })
      }
    } break
    case '/kcsapi/api_req_sortie/battle':
    case '/kcsapi/api_req_sortie/airbattle':
    case '/kcsapi/api_req_sortie/ld_airbattle':
    case '/kcsapi/api_req_combined_battle/battle':
    case '/kcsapi/api_req_combined_battle/battle_water':
    case '/kcsapi/api_req_combined_battle/airbattle':
    case '/kcsapi/api_req_combined_battle/ld_airbattle':
    case '/kcsapi/api_req_combined_battle/ec_battle':
    case '/kcsapi/api_req_combined_battle/each_battle':
    case '/kcsapi/api_req_combined_battle/each_battle_water':
    case '/kcsapi/api_req_battle_midnight/sp_midnight':
    case '/kcsapi/api_req_combined_battle/sp_midnight':
    case '/kcsapi/api_req_combined_battle/ec_night_to_day': {
      const { drop } = this
      drop.enemyShips1 = body.api_ship_ke
      drop.enemyShips2 = body.api_ship_ke_combined
      drop.enemyFormation = body.api_formation[1]
    } break
    case '/kcsapi/api_req_sortie/battleresult':
    case '/kcsapi/api_req_combined_battle/battleresult': {
      const { drop } = this
      drop.enemy = body.api_enemy_info.api_deck_name
      drop.quest = body.api_quest_name
      drop.rank = body.api_win_rank
      drop.shipId = (body.api_get_ship || {}).api_ship_id || -1
      drop.itemId = (body.api_get_useitem || {}).api_useitem_id || -1
      drop.teitokuLv = _teitokuLv
      this.report('/api/report/v2/drop_ship', drop)
      // Report pass event
      if (body.api_get_eventitem != null) {
        this.report('/api/report/v2/pass_event', {
          teitokuId: _teitokuId,
          teitokuLv: _teitokuLv,
          teitoku: _nickName,
          mapId: drop.mapId,
          mapLv: drop.mapLv,
        })
      }
    } break
    }
  }
}
