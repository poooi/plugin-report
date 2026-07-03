import _, { get } from 'lodash'
import BaseReporter from './base'
import type { APIShipData } from 'kcsapi/api_get_member/ship3/response'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'

type ShipStatShip = Pick<
  APIShipData,
  | 'api_kaihi'
  | 'api_kyouka'
  | 'api_lv'
  | 'api_sakuteki'
  | 'api_ship_id'
  | 'api_slot'
  | 'api_slot_ex'
  | 'api_taisen'
>

interface ShipStatResponseBody {
  api_ship_data: ShipStatShip[]
}

export default class ShipStatReporter extends BaseReporter {
  handle = (
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
    time: number,
  ) => {
    if (path !== '/kcsapi/api_get_member/ship3') {
      return
    }

    const response = body as ShipStatResponseBody
    const ship = get(response, ['api_ship_data', 0])

    // check if all slots are empty
    // api_slot_ex could be 0 (not enabled) or -1 (no item)
    if (
      _(ship.api_slot)
        .concat(ship.api_slot_ex)
        .some((id) => id > 0)
    ) {
      return
    }

    const taisenKyouka = ship.api_kyouka[6]

    void this.report('/api/report/v2/ship_stat', {
      id: ship.api_ship_id,
      lv: ship.api_lv,
      los: ship.api_sakuteki[0],
      los_max: ship.api_sakuteki[1],
      asw: ship.api_taisen[0] - taisenKyouka,
      asw_max: ship.api_taisen[1],
      evasion: ship.api_kaihi[0],
      evasion_max: ship.api_kaihi[1],
    })
  }
}
