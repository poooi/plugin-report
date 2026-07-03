import BaseReporter from './base'
import type { APIReqKousyouRemodelSlotRequest } from 'kcsapi/api_req_kousyou/remodel_slot/request'
import type { APIReqKousyouRemodelSlotResponse } from 'kcsapi/api_req_kousyou/remodel_slot/response'
import type { APIReqKousyouRemodelSlotlistDetailRequest } from 'kcsapi/api_req_kousyou/remodel_slotlist_detail/request'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'

type RemodelItemDetailPostBody = {
  api_slot_id: string | number
} & Partial<APIReqKousyouRemodelSlotlistDetailRequest>

type RemodelItemSlotPostBody = Pick<APIReqKousyouRemodelSlotRequest, 'api_certain_flag'> & {
  api_slot_id: string | number
}

type RemodelItemSlotBody = Pick<APIReqKousyouRemodelSlotResponse, 'api_remodel_id'> & {
  api_remodel_flag: boolean | number
}

// Stopped at 2016.11.28. We have collected 800k records.
export default class RemodelItemReporter extends BaseReporter {
  itemId: string | number
  itemLv: number

  constructor() {
    super()
    this.itemId = -1
    this.itemLv = -1
  }
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    const { _decks, _ships, _slotitems, _teitokuLv } = window
    switch (path) {
      case '/kcsapi/api_req_kousyou/remodel_slotlist_detail':
        {
          const request = postBody as RemodelItemDetailPostBody
          this.itemId = request.api_slot_id
          this.itemLv = _slotitems[this.itemId].api_level
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slot':
        {
          const response = body as RemodelItemSlotBody
          const request = postBody as RemodelItemSlotPostBody
          if (this.itemId != request.api_slot_id) {
            console.error(`Inconsistent remodel item data: #{this.itemId}, #{request.api_slot_id}`)
            return
          }
          const flagship = _ships[_decks[0].api_ship[0]]
          const consort = _ships[_decks[0].api_ship[1]]
          this.report('/api/report/v2/remodel_item', {
            successful: response.api_remodel_flag,
            itemId: response.api_remodel_id[0],
            itemLevel: this.itemId,
            flagshipId: flagship.api_ship_id,
            flagshipLevel: flagship.api_lv,
            flagshipCond: flagship.api_cond,
            consortId: consort.api_ship_id,
            consortLevel: consort.api_lv,
            consortCond: consort.api_cond,
            teitokuLv: _teitokuLv,
            certain: request.api_certain_flag,
          })
        }
        break
    }
  }
}
