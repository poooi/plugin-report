import _ from 'lodash'

import BaseReporter from './base'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'
import { getWindowShip, getWindowSlotItem } from '../types/window-state'
import type { WindowShip, WindowSlotItem } from '../types/window-state'

// Collect night contact data with followed conditions:
// 1. Non-combined fleet
// 2. Only one contactable plane equipped.
// 3. Plane level must be equal or larger than 0.
// 4. Plane count must larger than 0.
export default class NightContactReportor extends BaseReporter {
  VALID_PLANE_ID: number
  isValid: boolean | null

  constructor() {
    super()
    this.VALID_PLANE_ID = 102
    this.isValid = null
  }
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    const response = body as {
      api_deck_id?: number
      api_midnight_flag?: number
      api_kouku?: {
        api_stage1?: {
          api_disp_seiku?: number
          api_e_count?: number
          api_f_count?: number
        }
      }
      api_touch_plane?: number[]
    }
    switch (path) {
      case '/kcsapi/api_req_sortie/battle':
      case '/kcsapi/api_req_sortie/airbattle':
      case '/kcsapi/api_req_sortie/ld_airbattle':
        {
          const stage1 = _.get(response, 'api_kouku.api_stage1')
          if (!stage1) {
            this.isValid = false
            break
          }
          const planeCount = (stage1.api_f_count || 0) + (stage1.api_e_count || 0)
          this.isValid =
            response.api_midnight_flag === 1 &&
            planeCount > 0 &&
            stage1.api_disp_seiku != null &&
            [1, 2, 3].includes(stage1.api_disp_seiku)
        }
        break
      case '/kcsapi/api_req_battle_midnight/sp_midnight': {
        this.isValid = true
      } // eslint-disable-next-line no-fallthrough
      case '/kcsapi/api_req_battle_midnight/battle':
        {
          if (this.isValid === false) break
          const { _decks } = window
          const touchId = (response.api_touch_plane || [-1, -1])[0]

          const entries: Array<[WindowShip, WindowSlotItem]> = []
          const deck = _decks[(response.api_deck_id || 0) - 1]
          const ships = deck?.api_ship || []
          for (const sid of ships) {
            const ship = getWindowShip(sid)
            if (!ship) {
              continue
            }
            const items = ship.api_slot || []
            const count = ship.api_onslot || []
            for (const [iid, cnt] of _.zip(items, count)) {
              if (iid == null) {
                continue
              }
              const item = getWindowSlotItem(iid)
              // Condition * & 4
              if (item && item.api_slotitem_id === this.VALID_PLANE_ID && (cnt || 0) > 0) {
                entries.push([ship, item])
              }
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
          if (Object.values(info).some((value) => value == null)) {
            break
          }
          void this.report('/api/report/v2/night_contcat', info)
        }
        break
    }
  }
}
