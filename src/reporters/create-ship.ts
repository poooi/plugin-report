import BaseReporter from './base'
import type { APIGetMemberKdockResponse } from 'kcsapi/api_get_member/kdock/response'
import type { APIReqKousyouCreateshipRequest } from 'kcsapi/api_req_kousyou/createship/request'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'
import type { Reporter } from '../types/reporter'

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

const createShipPostBodyKeys: Array<keyof CreateShipPostBody> = [
  'api_highspeed',
  'api_item1',
  'api_item2',
  'api_item3',
  'api_item4',
  'api_item5',
  'api_kdock_id',
  'api_large_flag',
]

const isCreateShipPostBody = (postBody: GameApiPostBody): postBody is CreateShipPostBody =>
  createShipPostBodyKeys.every((key) => typeof postBody[key] === 'string')

export default class CreateShipReporter extends BaseReporter implements Reporter {
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
      if (!isCreateShipPostBody(postBody)) {
        console.error('Invalid create ship report data')
        return
      }
      this.creating = true
      this.kdockId = parseInt(postBody.api_kdock_id) - 1
      const secretaryIdx = _decks[0]?.api_ship[0]
      const secretary = secretaryIdx == null ? undefined : _ships[secretaryIdx]
      if (!secretary) {
        console.error('Invalid create ship secretary data')
        this.creating = false
        return
      }
      this.info = {
        items: [
          parseInt(postBody.api_item1),
          parseInt(postBody.api_item2),
          parseInt(postBody.api_item3),
          parseInt(postBody.api_item4),
          parseInt(postBody.api_item5),
        ],
        kdockId: this.kdockId,
        largeFlag: parseInt(postBody.api_large_flag) != 0,
        highspeed: parseInt(postBody.api_highspeed),
        secretary: secretary.api_ship_id,
        teitokuLv: _teitokuLv,
        shipId: -1,
      }
    }
    if (path === '/kcsapi/api_get_member/kdock') {
      if (!this.creating) return
      const { info } = this
      const docks = body as CreateShipKdock[]
      const dock = docks[this.kdockId]
      if (!info || !dock) {
        console.error('Invalid kdock create ship report data')
        return
      }
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
      void this.report('/api/report/v2/create_ship', info)
    }
  }
}
