import _ from 'lodash'
import { shipDataSelectorFactory, shipEquipDataSelectorFactory } from 'views/utils/selectors'

import BaseReporter from './base'
import { getHpStyle, getNightBattleSSCIType, getNightBattleDDCIType } from './utils'


export default class NightBattleCIReporter extends BaseReporter {
  processData = (body, time) => {
    const state = window.getStore()

    // normal map only
    if (state.sortie.sortieMapId > 100) {
      return
    }

    const deckId = (body.api_deck_id || body.api_dock_id || 0) - 1
    const deck   = window._decks[deckId]

    if (deck == null)  return

    const deckData = _(deck.api_ship)
      .map(shipId => {
        const [_ship = {}, $ship = {}] = shipDataSelectorFactory(shipId)(state) || []
        const equips = _(shipEquipDataSelectorFactory(shipId)(state))
          .filter(([_equip, $equip, onslot] = []) => !!_equip && !!$equip)
          .map(([_equip, $equip, onslot]) => ({ ...$equip, ..._equip }))
          .value()
        return [{...$ship, ..._ship}, equips]
      })
      .value()

    const ReportIndex = _(deckData)
      .map(([ship], index) => [2, 13, 14].includes(ship.api_stype) ? index : -1)
      .filter(i => i >= 0)
      .value()


    // api from body counts from array index 1
    const {
      api_f_nowhps,
      api_f_maxhps,
      api_ship_ke,
      api_flare_pos,
      api_hougeki,
    } = body

    const {
      api_at_eflag,
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
      equips.some(equip => equip.api_type[3] === 24) && api_f_nowhps[index] > 0
    )

    ReportIndex.forEach((i) => {
      const [ship, equips] = deckData[i]

      const type = ship.api_stype === 2
        ? 'DD'
        : 'SS'

      const CI = ship.api_stype === 2
        ? getNightBattleDDCIType(equips)
        : getNightBattleSSCIType(equips)
      if (!CI) {
        return
      }

      const startStatus = getHpStyle(api_f_nowhps[i] * 100 / api_f_maxhps[i])
      const endStatus = getHpStyle(endHps[i] * 100 / api_f_maxhps[i])

      // we will filter out heavily damaged and status changed ships
      // The stat will not be biased as those changed ships have consistent possibilities
      if (startStatus !== endStatus || startStatus === 'red') {
        return
      }

      const order = api_at_list.findIndex((pos, i) => pos === i && api_at_eflag[i] === 0)
      if (order < 0) {
        return
      }

      const defense = api_df_list[order][0]
      const defenseId = api_ship_ke[defense]
      const defenseTypeId = _.get(state, `const.$ships.${defenseId}.api_stype`)

      const damage = api_damage[order]

      const sp = api_sp_list[order]
      const si = api_si_list[order]
      const cl = api_cl_list[order]



      this.report('/api/report/v2/night_battle_ci', {
        shipId: ship.api_ship_id,
        type,
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
        damageTotal: _.sum(damage.filter(v => v > 0)),
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
