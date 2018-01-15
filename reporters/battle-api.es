import BaseReporter from './base'
import _ from 'lodash'

export default class BattleAPIReporter extends BaseReporter {
  constructor() {
    super()
    this.BATTLE_PATH = [
      '/kcsapi/api_req_practice/battle',
      '/kcsapi/api_req_sortie/battle',
      '/kcsapi/api_req_sortie/airbattle',
      '/kcsapi/api_req_sortie/ld_airbattle',
      '/kcsapi/api_req_combined_battle/battle',
      '/kcsapi/api_req_combined_battle/battle_water',
      '/kcsapi/api_req_combined_battle/airbattle',
      '/kcsapi/api_req_combined_battle/ld_airbattle',
      '/kcsapi/api_req_combined_battle/ec_battle',
      '/kcsapi/api_req_combined_battle/each_battle',
      '/kcsapi/api_req_combined_battle/each_battle_water',
      '/kcsapi/api_req_practice/midnight_battle',
      '/kcsapi/api_req_battle_midnight/battle',
      '/kcsapi/api_req_battle_midnight/sp_midnight',
      '/kcsapi/api_req_combined_battle/midnight_battle',
      '/kcsapi/api_req_combined_battle/sp_midnight',
      '/kcsapi/api_req_combined_battle/ec_midnight_battle',
      '/kcsapi/api_req_combined_battle/ec_night_to_day',
    ]
    this.BATTLE_KEYS = [
      'api_active_deck',
      'api_dock_id', 'api_deck_id',
      'api_ship_ke', 'api_ship_ke_combined',
      'api_ship_lv', 'api_ship_lv_combined',
      'api_nowhps',  'api_nowhps_combined',
      'api_maxhps',  'api_maxhps_combined',
      'api_eSlot',   'api_eSlot_combined',
      'api_eKyouka', 'api_eKyouka_combined',  // Currently ~_combined not found
      'api_fParam',  'api_fParam_combined',
      'api_eParam',  'api_eParam_combined',
      'api_midnight_flag',
      'api_boss_damaged',  'api_xal01',
      'api_escape_idx',    'api_escape_idx_combined',
      'api_combat_ration', 'api_combat_ration_combined',
      'api_search',        'api_formation',
      'api_touch_plane',   'api_flare_pos',
      'api_air_base_injection',
      'api_air_base_attack',
      'api_injection_kouku',
      'api_stage_flag',          'api_kouku',
      'api_stage_flag2',         'api_kouku2',
      'api_support_flag',        'api_support_info',
      'api_opening_taisen_flag', 'api_opening_taisen',
      'api_opening_flag',        'api_opening_atack',
      'api_hourai_flag',
      'api_hougeki1', 'api_hougeki2', 'api_hougeki3',
      'api_raigeki',
      'api_hougeki',
      'api_n_support_flag',      'api_n_support_info',
      'api_n_hougeki1', 'api_n_hougeki2',
    ]
  }
  handle(method, path, body, postBody) {
    if (this.BATTLE_PATH.includes(path)) {
      const data = {}
      _.forIn(body, (value, key) => {
        if (value == null)
          return
        if (!this.BATTLE_KEYS.includes(key))
          data[key] = value
      })
      if (Object.keys(data).length > 0) {
        this.BATTLE_KEYS.concat(Object.keys(data))
        this.report("/api/report/v2/battle_api", {path, data})
      }
    }
  }
}
