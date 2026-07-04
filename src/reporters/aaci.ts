import _ from 'lodash'
import { shipDataSelectorFactory, shipEquipDataSelectorFactory } from 'views/utils/selectors'
import type * as aaciModule from 'views/utils/aaci'

import BaseReporter from './base'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'
import type { Reporter } from '../types/reporter'
import type { NightBattleEquip } from './utils'

interface AACIShip {
  api_kyouka: number[]
  api_luck: number[]
  api_lv: number
  api_maxhp: number
  api_nowhp: number
  api_ship_id: number
  api_tyku: number[]
}

interface AACIBattleBody {
  api_deck_id?: number
  api_dock_id?: number
  api_kouku?: {
    api_stage2?: {
      api_air_fire?: {
        api_idx?: number
        api_kind?: number
      }
      api_e_count?: number
    }
  }
}

type ShipSelectorResult = [Partial<AACIShip>?, Partial<AACIShip>?]
type EquipSelectorResult = Array<[Partial<NightBattleEquip>?, Partial<NightBattleEquip>?, unknown?]>
type GetShipAACIs = (ship: AACIShip, equips: NightBattleEquip[]) => number[]
type AACIModule = typeof aaciModule

export default class AACIReporter extends BaseReporter implements Reporter {
  getShipAACIs: GetShipAACIs | null = null

  constructor() {
    super()
    try {
      // Runtime-provided optional Poi module; keep require guarded so reporter load still succeeds without it.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const aaci = require('views/utils/aaci') as AACIModule
      this.getShipAACIs = aaci.getShipAACIs
    } catch (err) {
      // console.log(`AACI reporter is disabled.`)
    }
  }
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    if (this.getShipAACIs == null) {
      return
    }
    const getShipAACIs = this.getShipAACIs
    const { _decks } = window
    switch (path) {
      case '/kcsapi/api_req_sortie/battle':
        {
          const response = body as AACIBattleBody
          const deckId = (response.api_deck_id || response.api_dock_id || 0) - 1
          const deck = _decks[deckId]
          const state = window.getStore()
          if (deck == null) break

          // Available AACI
          const deckData: Array<[AACIShip, NightBattleEquip[]]> = (deck.api_ship || []).map(
            (shipId) => {
              const [_ship = {}, $ship = {}] =
                (shipDataSelectorFactory(shipId)(state) as ShipSelectorResult | undefined) || []
              const equips = (
                (shipEquipDataSelectorFactory(shipId)(state) as EquipSelectorResult | undefined) ||
                []
              )
                .filter(
                  (entry: [Partial<NightBattleEquip>?, Partial<NightBattleEquip>?, unknown?]) => {
                    const [_equip, $equip] = entry
                    return !!_equip && !!$equip
                  },
                )
                .map(([_equip, $equip]) => ({ ...$equip, ..._equip }))
              return [{ ...$ship, ..._ship } as AACIShip, equips as NightBattleEquip[]]
            },
          )
          const deckAACIs = deckData.map(([ship, equips]) => getShipAACIs(ship, equips))
          const availIdx = deckAACIs.findIndex((aaci) => aaci.length > 0)
          const availKind = deckAACIs[availIdx]
          if (deckAACIs.filter((aaci) => aaci.length > 0).length !== 1) break // Report one available ship only.
          if (!availKind) break

          // Triggered AACI
          if (_.get(response, 'api_kouku.api_stage2.api_e_count', 0) <= 0) break
          const idx = _.get(response, 'api_kouku.api_stage2.api_air_fire.api_idx')
          const kind = _.get(response, 'api_kouku.api_stage2.api_air_fire.api_kind')
          if (idx == null && kind == null) {
            // No AACI trigger fields means report available AACI only.
          } else if (kind == null || idx !== availIdx || !availKind.includes(kind)) {
            break
          }

          const [ship, equips] = deckData[availIdx]
          if (!ship || !equips) break

          // Report
          void this.report('/api/report/v2/aaci', {
            poiVersion: window.POI_VERSION,
            available: availKind,
            triggered: kind,
            items: equips.map((equip) => equip.api_slotitem_id),
            improvement: equips.map((equip) => equip.api_level || 0),
            rawLuck: (ship.api_luck[0] || 0) + (ship.api_kyouka[4] || 0),
            rawTaiku: (ship.api_tyku[0] || 0) + (ship.api_kyouka[2] || 0),
            lv: ship.api_lv,
            hpPercent: Math.floor((ship.api_nowhp * 10000) / ship.api_maxhp) / 100,
            pos: idx,
          })
        }
        break
    }
  }
}
