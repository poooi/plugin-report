import BaseReporter from './base'
import type { APIGetMemberKdockResponse } from 'kcsapi/api_get_member/kdock/response'
import type { APIReqKousyouCreateshipRequest } from 'kcsapi/api_req_kousyou/createship/request'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'

type CreateShipPostBody = Pick<
  APIReqKousyouCreateshipRequest,
  | 'api_highspeed'
  | 'api_item1'
  | 'api_item2'
  | 'api_item3'
  | 'api_item4'
  | 'api_item5'
  | 'api_kdock_id'
  | 'api_large_flag'
>

type CreateShipKdock = Pick<
  APIGetMemberKdockResponse,
  'api_created_ship_id' | 'api_item1' | 'api_item2' | 'api_item3' | 'api_item4' | 'api_item5'
>

interface CreateShipReportPayload {
  items: number[]
  kdockId: number
  largeFlag: boolean
  highspeed: number
  secretary: number
  teitokuLv: number
  shipId: number
}

export default class CreateShipReporter extends BaseReporter {
  creating: boolean
  kdockId: number
  info: CreateShipReportPayload | null

  constructor() {
    super()

    this.creating = false
    this.kdockId = -1
    this.info = null
  }
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createship') {
      const request = postBody as CreateShipPostBody
      this.creating = true
      this.kdockId = parseInt(request.api_kdock_id) - 1
      const secretaryIdx = _decks[0].api_ship[0]
      this.info = {
        items: [
          parseInt(request.api_item1),
          parseInt(request.api_item2),
          parseInt(request.api_item3),
          parseInt(request.api_item4),
          parseInt(request.api_item5),
        ],
        kdockId: this.kdockId,
        largeFlag: parseInt(request.api_large_flag) != 0,
        highspeed: parseInt(request.api_highspeed),
        secretary: _ships[secretaryIdx].api_ship_id,
        teitokuLv: _teitokuLv,
        shipId: -1,
      }
    }
    if (path === '/kcsapi/api_get_member/kdock') {
      if (!this.creating) return
      const { info } = this
      const docks = body as CreateShipKdock[]
      const dock = docks[this.kdockId]
      if (
        dock.api_item1 != info.items[0] ||
        dock.api_item2 != info.items[1] ||
        dock.api_item3 != info.items[2] ||
        dock.api_item4 != info.items[3] ||
        dock.api_item5 != info.items[4]
      )
        return
      info.shipId = dock.api_created_ship_id
      this.creating = false
      this.report('/api/report/v2/create_ship', info)
    }
  }
}
