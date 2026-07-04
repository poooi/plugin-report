import BaseReporter from './base'
import type { APIReqKousyouCreateitemRequest } from 'kcsapi/api_req_kousyou/createitem/request'
import type { APIReqKousyouCreateitemResponse } from 'kcsapi/api_req_kousyou/createitem/response'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'
import type { Reporter } from '../types/reporter'
import { parseInt10 } from '../types/window-state'

type CreateItemPostBodyKey = keyof Pick<
  APIReqKousyouCreateitemRequest,
  'api_item1' | 'api_item2' | 'api_item3' | 'api_item4'
>

type CreateItemPostBody = Record<CreateItemPostBodyKey, string | number>

type CreateItemResponseBody = Pick<APIReqKousyouCreateitemResponse, 'api_get_items'>

const isCreateItemPostBody = (postBody: GameApiPostBody): postBody is CreateItemPostBody =>
  (['api_item1', 'api_item2', 'api_item3', 'api_item4'] as CreateItemPostBodyKey[]).every((key) =>
    ['number', 'string'].includes(typeof postBody[key]),
  )

const isCreateItemResponseBody = (body: GameApiResponseBody): body is CreateItemResponseBody =>
  body != null &&
  typeof body === 'object' &&
  Array.isArray((body as Partial<CreateItemResponseBody>).api_get_items)

export default class CreateItemReporter extends BaseReporter implements Reporter {
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createitem') {
      if (!isCreateItemResponseBody(body) || !isCreateItemPostBody(postBody)) {
        console.error('Invalid create item report data')
        return
      }
      const secretaryIdx = _decks[0]?.api_ship[0]
      const secretary = secretaryIdx == null ? undefined : _ships[secretaryIdx]
      if (!secretary) {
        console.error('Invalid create item secretary data')
        return
      }
      body.api_get_items.forEach((item) => {
        void this.report('/api/report/v2/create_item', {
          items: [
            parseInt10(postBody.api_item1),
            parseInt10(postBody.api_item2),
            parseInt10(postBody.api_item3),
            parseInt10(postBody.api_item4),
          ],
          itemId: item.api_slotitem_id,
          teitokuLv: _teitokuLv,
          secretary: secretary.api_ship_id,
          successful: item.api_slotitem_id !== -1,
        })
      })
    }
  }
}
