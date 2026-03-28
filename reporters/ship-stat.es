import _, { get } from 'lodash'
import BaseReporter from './base'

const makeShipStatReport = (ship, eqStats = { evasion: 0, asw: 0, los: 0 }) => ({
  id: ship.api_ship_id,
  lv: ship.api_lv,
  evasion: ship.api_kaihi[0] - eqStats.evasion,
  evasion_max: ship.api_kaihi[1],
  asw: ship.api_taisen[0] - ship.api_kyouka[6] - eqStats.asw,
  asw_max: ship.api_taisen[1],
  los: ship.api_sakuteki[0] - eqStats.los,
  los_max: ship.api_sakuteki[1],
})

export default class ShipStatReporter extends BaseReporter {
  handle = (method, path, body, postBody, time) => {
    switch (path) {
      case '/kcsapi/api_req_kousyou/getship':
        {
          const eqStats = { evasion: 0, asw: 0, los: 0 }
          for (const { api_slotitem_id } of body.api_slotitem) {
            const e = window.$slotitems[api_slotitem_id]
            if (!e) {
              return
            }
            eqStats.evasion += e.api_houk
            eqStats.asw += e.api_tais
            eqStats.los += e.api_saku
          }

          this.report('/api/report/v2/ship_stat', makeShipStatReport(body.api_ship, eqStats))
        }
        break
      case '/kcsapi/api_get_member/ship3':
        {
          const ship = get(body, ['api_ship_data', 0])

          // check if all slots are empty
          // api_slot_ex could be 0 (not enabled) or -1 (no item)
          if (
            _(ship.api_slot)
              .concat(ship.api_slot_ex)
              .some(id => id > 0)
          ) {
            return
          }

          this.report('/api/report/v2/ship_stat', makeShipStatReport(ship))
        }
        break
    }
  }
}
