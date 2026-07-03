import BaseReporter from './base'
import { getOwnedShipSnapshot, getTeitokuHash, getFirstPlaneCounts } from './utils'
import type { PlaneCountData } from './utils'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'

interface EnemyReportSource extends PlaneCountData {
  api_eParam?: number[][]
  api_eParam_combined?: number[][]
  api_eSlot?: number[][]
  api_eSlot_combined?: number[][]
  api_e_maxhps?: number[]
  api_e_maxhps_combined?: number[]
  api_ship_ke?: number[]
  api_ship_ke_combined?: number[]
  api_ship_lv?: number[]
  api_ship_lv_combined?: number[]
}

interface MapInfoBody {
  api_map_info: Array<{
    api_eventmap?: {
      api_selected_rank: number
    } | null
    api_id: number
  }>
}

type SelectRankPostBody = GameApiPostBody & {
  api_map_no: string
  api_maparea_id: string
  api_rank: string
}

interface MapStartBody {
  api_destruction_battle?: EnemyReportSource
  api_event_id: number
  api_maparea_id: number
  api_mapinfo_no: number
  api_no: number
}

interface BattleBody extends EnemyReportSource {
  api_formation: number[]
}

interface BattleResultBody {
  api_enemy_info: {
    api_deck_name: string
  }
  api_get_base_exp: number
  api_get_eventitem?: Array<{
    api_id: number
    api_slot_level?: number
    api_type: number
    api_value: number
  }> | null
  api_get_ship?: {
    api_ship_id?: number
  }
  api_get_useitem?: {
    api_useitem_id?: number
  }
  api_quest_name: string
  api_win_rank: string
}

interface DropReport {
  baseExp: number | null
  cellId: number | null
  enemy: string | null
  enemyFormation: number | null
  enemyShips1: number[] | null | undefined
  enemyShips2: number[] | null | undefined
  isBoss: boolean | null
  itemId: number | null
  mapId: number | null
  mapLv: number | null
  ownedShipSnapshot?: Record<string, number[]>
  quest: string | null
  rank: string | null
  shipCounts: number | null
  shipId: number | null
  teitokuId: string | null
  teitokuLv: number | null
}

/**
 * Make enemy_info report record from API data.
 */
const makeEnemyReport = (data: EnemyReportSource = {}) => {
  const { planes, bombersMin, bombersMax } = getFirstPlaneCounts(data) || {}
  return {
    ships1: data.api_ship_ke || [],
    levels1: data.api_ship_lv || [],
    hp1: data.api_e_maxhps || [],
    stats1: data.api_eParam || [],
    equips1: data.api_eSlot || [],
    ships2: data.api_ship_ke_combined || [],
    levels2: data.api_ship_lv_combined || [],
    hp2: data.api_e_maxhps_combined || [],
    stats2: data.api_eParam_combined || [],
    equips2: data.api_eSlot_combined || [],
    planes: planes || 0,
    bombersMin: bombersMin || 0,
    bombersMax: bombersMax || 0,
  }
}

export default class DropShipReporter extends BaseReporter {
  mapLv: number[]
  drop: DropReport | null
  ownedShipSnapshot: Record<string, number[]> | null

  constructor() {
    super()

    this.mapLv = []
    this.drop = null
    this.ownedShipSnapshot = null
  }
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    const { mapLv } = this
    const { _teitokuLv } = window
    const teitokuId = getTeitokuHash()
    switch (path) {
      case '/kcsapi/api_get_member/mapinfo':
        {
          const response = body as MapInfoBody
          for (const map of response.api_map_info) {
            mapLv[map.api_id] = 0
            if (map.api_eventmap != null) mapLv[map.api_id] = map.api_eventmap.api_selected_rank
          }
        }
        break
      case '/kcsapi/api_req_map/select_eventmap_rank':
        {
          const request = postBody as SelectRankPostBody
          const mapareaId = parseInt(request.api_maparea_id) * 10 + parseInt(request.api_map_no)
          const rank = parseInt(request.api_rank)
          mapLv[mapareaId] = parseInt(request.api_rank)
          // Report select map difficulty
          this.report('/api/report/v2/select_rank', {
            teitokuId,
            teitokuLv: _teitokuLv,
            mapareaId: mapareaId,
            rank: rank,
          })
        }
        break
      case '/kcsapi/api_req_map/start':
      case '/kcsapi/api_req_map/next':
        {
          const response = body as MapStartBody
          const drop: DropReport = {
            mapId: null,
            cellId: null,
            isBoss: null,
            mapLv: null,
            enemy: null,
            enemyShips1: null,
            enemyShips2: null,
            enemyFormation: null,
            baseExp: null,
            quest: null,
            rank: null,
            shipId: null,
            itemId: null,
            shipCounts: null,
            teitokuLv: null,
            teitokuId: null,
          }
          drop.mapId = response.api_maparea_id * 10 + response.api_mapinfo_no
          drop.cellId = response.api_no
          drop.isBoss = response.api_event_id == 5
          drop.mapLv = mapLv[drop.mapId]
          this.drop = drop
          this.ownedShipSnapshot = getOwnedShipSnapshot()
          if (response.api_destruction_battle) {
            // Report enemy fleet info for air raids
            this.report(
              '/api/report/v2/enemy_info',
              makeEnemyReport(response.api_destruction_battle),
            )
          }
        }
        break
      case '/kcsapi/api_req_sortie/battle':
      case '/kcsapi/api_req_sortie/airbattle':
      case '/kcsapi/api_req_sortie/night_to_day':
      case '/kcsapi/api_req_sortie/ld_airbattle':
      case '/kcsapi/api_req_sortie/ld_shooting':
      case '/kcsapi/api_req_battle_midnight/sp_midnight':
      case '/kcsapi/api_req_combined_battle/battle':
      case '/kcsapi/api_req_combined_battle/battle_water':
      case '/kcsapi/api_req_combined_battle/airbattle':
      case '/kcsapi/api_req_combined_battle/ld_airbattle':
      case '/kcsapi/api_req_combined_battle/ld_shooting':
      case '/kcsapi/api_req_combined_battle/ec_battle':
      case '/kcsapi/api_req_combined_battle/each_battle':
      case '/kcsapi/api_req_combined_battle/each_battle_water':
      case '/kcsapi/api_req_combined_battle/sp_midnight':
      case '/kcsapi/api_req_combined_battle/ec_night_to_day':
        {
          const response = body as BattleBody
          const drop = this.drop
          if (!drop) {
            console.error(`Missing drop state for battle report: ${path}`)
            return
          }
          drop.enemyShips1 = response.api_ship_ke
          drop.enemyShips2 = response.api_ship_ke_combined
          drop.enemyFormation = response.api_formation[1]
          // Report enemy fleet info
          this.report('/api/report/v2/enemy_info', makeEnemyReport(response))
        }
        break
      case '/kcsapi/api_req_sortie/battleresult':
      case '/kcsapi/api_req_combined_battle/battleresult':
        {
          const response = body as BattleResultBody
          const drop = this.drop
          if (!drop) {
            console.error(`Missing drop state for battle result report: ${path}`)
            return
          }
          drop.enemy = response.api_enemy_info.api_deck_name
          drop.quest = response.api_quest_name
          drop.rank = response.api_win_rank
          drop.baseExp = response.api_get_base_exp
          drop.shipId = (response.api_get_ship || {}).api_ship_id || -1
          drop.itemId = (response.api_get_useitem || {}).api_useitem_id || -1
          drop.ownedShipSnapshot = this.ownedShipSnapshot
          drop.teitokuLv = _teitokuLv
          drop.teitokuId = teitokuId
          // Report enemy pattern and drops
          this.report('/api/report/v2/drop_ship', drop).then(() => {
            this.drop = null
          })
          // Report pass event
          if (response.api_get_eventitem != null) {
            this.report('/api/report/v2/pass_event', {
              teitokuId,
              teitokuLv: _teitokuLv,
              mapId: drop.mapId,
              mapLv: drop.mapLv,
              rewards: !Array.isArray(response.api_get_eventitem)
                ? null
                : response.api_get_eventitem.map((e) => ({
                    rewardType: e.api_type,
                    rewardId: e.api_id,
                    rewardCount: e.api_value,
                    rewardLevel: e.api_slot_level || 0,
                  })),
            })
          }
        }
        break
    }
  }
}
