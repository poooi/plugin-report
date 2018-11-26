import _ from 'lodash'

import BaseReporter from './base'

// Collect night contact data with followed conditions:
// 1. Non-combined fleet
// 2. Only one contactable plane equipped.
// 3. Plane level must be equal or larger than 0.
// 4. Plane count must larger than 0.
export default class NightContactReportor extends BaseReporter {
  constructor() {
    super()
    this.VALID_PLANE_ID = 102
    this.isValid = null
  }
  handle(method, path, body, postBody) {
    switch (path) {
      case '/kcsapi/api_req_sortie/battle':
      case '/kcsapi/api_req_sortie/airbattle':
      case '/kcsapi/api_req_sortie/ld_airbattle':
        {
          const stage1 = _.get(body, 'api_kouku.api_stage1')
          const planeCount = (stage1.api_f_count || 0) + (stage1.api_e_count || 0)
          this.isValid =
            body.api_midnight_flag === 1 &&
            planeCount > 0 &&
            [1, 2, 3].includes(stage1.api_disp_seiku)
        }
        break
      case '/kcsapi/api_req_battle_midnight/sp_midnight': {
        this.isValid = true
      } // eslint-disable-next-line no-fallthrough
      case '/kcsapi/api_req_battle_midnight/battle':
        {
          if (this.isValid === false) break
          const { _decks, _ships, _slotitems } = window
          const touchId = (body.api_touch_plane || [-1, -1])[0]

          const entries = [] // Array of [ship, item] pairs
          const deck = _decks[body.api_deck_id - 1] || {}
          const ships = deck.api_ship || []
          for (const sid of ships) {
            const ship = _ships[sid] || {}
            const items = ship.api_slot || []
            const count = ship.api_onslot || []
            for (const [iid, cnt] of _.zip(items, count)) {
              const item = _slotitems[iid] || {}
              // Condition * & 4
              if (item.api_slotitem_id === this.VALID_PLANE_ID && cnt > 0)
                entries.push([ship, item])
            }
          }
          if (!(entries.length === 1))
            // Condition 2
            break

          const [ship, item] = entries[0]
          const info = {
            fleetType: 0,
            shipId: ship.api_ship_id,
            shipLv: ship.api_lv,
            itemId: item.api_slotitem_id,
            itemLv: item.api_level,
            contact: touchId > -1,
          }
          if (!(0 <= info.itemLv && info.itemLv <= 10))
            // Condition 3
            break

          // Prevent reporting data with null value.
          for (const k of Object.keys(info)) {
            if (info[k] == null) break
          }
          this.report('/api/report/v2/night_contcat', info)
        }
        break
    }
  }
}
