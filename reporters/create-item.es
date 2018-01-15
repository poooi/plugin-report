import BaseReporter from './base'

export default class CreateItemReporter extends BaseReporter {
  handle(method, path, body, postBody) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createitem') {
      const secretaryIdx = _decks[0].api_ship[0]
      this.report("/api/report/v2/create_item", {
        items: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4)],
        itemId   : body.api_create_flag == 1 ? body.api_slot_item.api_slotitem_id : parseInt(body.api_fdata.split(',')[1]),
        teitokuLv: _teitokuLv,
        secretary: _ships[secretaryIdx].api_ship_id,
        successful: body.api_create_flag == 1,
      })
    }
  }
}
