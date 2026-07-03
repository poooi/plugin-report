import BaseReporter from './base'
import type { APIReqKousyouCreateitemRequest } from 'kcsapi/api_req_kousyou/createitem/request'
import type { APIReqKousyouCreateitemResponse } from 'kcsapi/api_req_kousyou/createitem/response'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'

type CreateItemPostBody = Pick<
  APIReqKousyouCreateitemRequest,
  'api_item1' | 'api_item2' | 'api_item3' | 'api_item4'
>

type CreateItemResponseBody = Pick<APIReqKousyouCreateitemResponse, 'api_get_items'>

export default class CreateItemReporter extends BaseReporter {
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createitem') {
      const response = body as CreateItemResponseBody
      const request = postBody as CreateItemPostBody
      const secretaryIdx = _decks[0].api_ship[0]
      response.api_get_items.forEach((item) => {
        this.report('/api/report/v2/create_item', {
          items: [
            parseInt(request.api_item1),
            parseInt(request.api_item2),
            parseInt(request.api_item3),
            parseInt(request.api_item4),
          ],
          itemId: item.api_slotitem_id,
          teitokuLv: _teitokuLv,
          secretary: _ships[secretaryIdx].api_ship_id,
          successful: item.api_slotitem_id !== -1,
        })
      })
    }
  }
}
