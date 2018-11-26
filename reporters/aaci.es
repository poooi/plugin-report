import _ from 'lodash'
import { shipDataSelectorFactory, shipEquipDataSelectorFactory } from 'views/utils/selectors'

import BaseReporter from './base'

export default class AACIReporter extends BaseReporter {
  constructor() {
    super()
    try {
      const aaci = require('views/utils/aaci')
      this.getShipAACIs = aaci.getShipAACIs
    } catch (err) {
      // console.log(`AACI reporter is disabled.`)
    }
  }
  handle(method, path, body, postBody) {
    if (this.getShipAACIs == null) {
      return
    }
    const { _decks } = window
    switch (path) {
      case '/kcsapi/api_req_sortie/battle':
        {
          const deckId = (body.api_deck_id || body.api_dock_id || 0) - 1
          const deck = _decks[deckId]
          const state = window.getStore()
          if (deck == null) break

          // Available AACI
          const deckData = (deck.api_ship || []).map(shipId => {
            const [_ship = {}, $ship = {}] = shipDataSelectorFactory(shipId)(state) || []
            const equips = (shipEquipDataSelectorFactory(shipId)(state) || [])
              .filter(([_equip, $equip, onslot] = []) => !!_equip && !!$equip)
              .map(([_equip, $equip, onslot]) => ({ ...$equip, ..._equip }))
            return [{ ...$ship, ..._ship }, equips]
          })
          const deckAACIs = deckData.map(([ship, equips]) => this.getShipAACIs(ship, equips))
          const availIdx = deckAACIs.findIndex(aaci => aaci.length > 0)
          const availKind = deckAACIs[availIdx]
          if (deckAACIs.filter(aaci => aaci.length > 0).length !== 1) break // Report one available ship only.

          // Triggered AACI
          if (_.get(body, 'api_kouku.api_stage2.api_e_count', 0) <= 0) break
          const idx = _.get(body, 'api_kouku.api_stage2.api_air_fire.api_idx')
          const kind = _.get(body, 'api_kouku.api_stage2.api_air_fire.api_kind')
          if (!((idx == null && kind == null) || (idx === availIdx && availKind.includes(kind))))
            break

          const [ship, equips] = deckData[availIdx]

          // Report
          this.report('/api/report/v2/aaci', {
            poiVersion: window.POI_VERSION,
            available: availKind,
            triggered: kind,
            items: equips.map(equip => equip.api_slotitem_id),
            improvement: equips.map(equip => equip.api_level || 0),
            rawLuck: ship.api_luck[0] + ship.api_kyouka[4],
            rawTaiku: ship.api_tyku[0] + ship.api_kyouka[2],
            lv: ship.api_lv,
            hpPercent: Math.floor((ship.api_nowhp * 10000) / ship.api_maxhp) / 100,
            pos: idx,
          })
        }
        break
    }
  }
}
