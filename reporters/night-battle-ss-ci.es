import _ from 'lodash'
import { shipDataSelectorFactory, shipEquipDataSelectorFactory } from 'views/utils/selectors'

import BaseReporter from './base'
import { getHpStyle, getNightBattleSSCIType } from './utils'


export default class NightBattleSSCIReporter extends BaseReporter {
  processData = (body, time) => {
    const state = window.getStore()

    // normal map only
    if (state.sortie.sortieMapId > 100) {
      return
    }

    const deckId = (body.api_deck_id || body.api_dock_id || 0) - 1
    const deck   = window._decks[deckId]

    if (deck == null)  return

    const deckData = (deck.api_ship || []).map(shipId => {
      const [_ship = {}, $ship = {}] = shipDataSelectorFactory(shipId)(state) || []
      const equips = (shipEquipDataSelectorFactory(shipId)(state) || [])
        .filter(([_equip, $equip, onslot] = []) => !!_equip && !!$equip)
        .map(([_equip, $equip, onslot]) => ({ ...$equip, ..._equip }))
      return [{...$ship, ..._ship}, equips]
    })

    const SSIndex = deckData
      .map(([ship, _], index) => [13, 14].includes(ship.api_stype) ? index : -1)
      .filter(i => i >= 0)

    // api from body counts from array index 1
    const {
      api_nowhps,
      api_maxhps,
      api_ship_ke,
      api_flare_pos,
      api_hougeki,
    } = body

    const {
      api_at_list,
      api_df_list,
      api_si_list,
      api_sp_list,
      api_cl_list,
      api_damage,
    } = api_hougeki

    // api from lib battle counts from array index 0
    const endHps = _.get(state, 'battle._status.result.deckHp', [])

    const searchLight = deckData.some(([_, equips], index) =>
      equips.some(equip => equip.api_type[3] === 24) && api_nowhps[index + 1] > 0
    )

    SSIndex.forEach((i) => {
      const CI = getNightBattleSSCIType(deckData[i][1])
      if (!CI) {
        return
      }

      const startStatus = getHpStyle(api_nowhps[i + 1] * 100 / api_maxhps[i + 1])
      const endStatus = getHpStyle(endHps[i] * 100 / api_maxhps[i + 1])

      if (startStatus !== endStatus || startStatus === 'red') {
        return
      }

      const order = api_at_list.findIndex(pos => pos === i + 1)
      if (order <= 0) { // api_at_list[0] is always -1
        return
      }

      const defense = api_df_list[order][0]
      const defenseId = api_ship_ke[defense - 6]
      const defenseTypeId = _.get(state, `const.$ships.${defenseId}.api_stype`)

      const damage = api_damage[order]

      const sp = api_sp_list[order]
      const si = api_si_list[order]
      const cl = api_cl_list[order]

      const [ship, equips] = deckData[i]

      this.report('/api/report/v2/night_battle_ss_ci', {
        shipId: ship.api_ship_id,
        CI,
        lv: ship.api_lv,
        rawLuck: ship.api_luck[0] + ship.api_kyouka[4],
        pos: i,
        status: startStatus,
        items: equips.map(equip => equip.api_slotitem_id),
        improvement: equips.map(equip => equip.api_level || 0),
        searchLight,
        flare: api_flare_pos[0],
        defenseId,
        defenseTypeId,
        ciType: sp,
        display: _.isArray(si) ? si.map(Number) : [Number(si)], // could this be -1?
        hitType: cl,
        damage,
        damageTotal: _.sum(damage),
        time,
      })
    })
  }

  handle(method, path, body, postBody, time) {
    switch(path) {
    case '/kcsapi/api_req_battle_midnight/battle': {
      // delay to wait for updated battle store
      setTimeout(() => this.processData(body, time), 1000)
    } break
    }
  }
}
