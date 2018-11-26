import BaseReporter from './base'

// Stopped at 2016.11.28. We have collected 800k records.
export default class RemodelItemReporter extends BaseReporter {
  constructor() {
    super()
    this.itemId = -1
    this.itemLv = -1
  }
  handle(method, path, body, postBody) {
    const { _decks, _ships, _slotitems, _teitokuLv } = window
    switch (path) {
      case '/kcsapi/api_req_kousyou/remodel_slotlist_detail':
        {
          this.itemId = postBody.api_slot_id
          this.itemLv = _slotitems[this.itemId].api_level
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slot':
        {
          if (this.itemId != postBody.api_slot_id) {
            console.error(`Inconsistent remodel item data: #{this.itemId}, #{postBody.api_slot_id}`)
            return
          }
          const flagship = _ships[_decks[0].api_ship[0]]
          const consort = _ships[_decks[0].api_ship[1]]
          this.report('/api/report/v2/remodel_item', {
            successful: body.api_remodel_flag,
            itemId: body.api_remodel_id[0],
            itemLevel: this.itemId,
            flagshipId: flagship.api_ship_id,
            flagshipLevel: flagship.api_lv,
            flagshipCond: flagship.api_cond,
            consortId: consort.api_ship_id,
            consortLevel: consort.api_lv,
            consortCond: consort.api_cond,
            teitokuLv: _teitokuLv,
            certain: postBody.api_certain_flag,
          })
        }
        break
    }
  }
}
