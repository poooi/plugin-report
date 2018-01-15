import BaseReporter from './base'

export class CreateShipReporter extends BaseReporter {
  constructor() {
    super()

    this.creating = false
    this.kdockId  = -1
    this.info     = null
  }
  handle(method, path, body, postBody) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createship') {
      this.creating = true
      this.kdockId = parseInt(postBody.api_kdock_id) - 1
      const secretaryIdx = _decks[0].api_ship[0]
      this.info = {
        items: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4), parseInt(postBody.api_item5)],
        kdockId  : this.kdockId,
        largeFlag: parseInt(postBody.api_large_flag) != 0,
        highspeed: parseInt(postBody.api_highspeed),
        secretary: _ships[secretaryIdx].api_ship_id,
        teitokuLv: _teitokuLv,
        shipId   : -1,
      }
    }
    if (path === '/kcsapi/api_get_member/kdock') {
      if (!this.creating) return
      const { info } = this
      const dock = body[this.kdockId]
      if (dock.api_item1 != info.items[0] || dock.api_item2 != info.items[1] || dock.api_item3 != info.items[2] || dock.api_item4 != info.items[3] || dock.api_item5 != info.items[4]) return
      info.shipId = dock.api_created_ship_id
      this.creating = false
      this.report("/api/report/v2/create_ship", info)
    }
  }
}
