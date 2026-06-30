import BaseReporter from './base'

export default class CreateItemReporter extends BaseReporter {
  handle(method, path, body, postBody) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createitem') {
      const secretaryIdx = _decks[0].api_ship[0]
      body.api_get_items.forEach(item => {
        this.report('/api/report/v2/create_item', {
          items: [
            parseInt(postBody.api_item1),
            parseInt(postBody.api_item2),
            parseInt(postBody.api_item3),
            parseInt(postBody.api_item4),
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
