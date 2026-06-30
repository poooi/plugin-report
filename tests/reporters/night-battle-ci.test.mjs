import { beforeEach, describe, expect, it } from 'vitest'

import {
  attachReportSpy,
  equip,
  NightBattleCIReporter,
  resetReporterTestState,
  selectorState,
  ship,
} from '../helpers/reporter-test-harness.mjs'

beforeEach(resetReporterTestState)

describe('NightBattleCIReporter', () => {
  it('reports cut-in payloads from battle state and API attack data', () => {
    window._decks = [{ api_ship: [1] }]
    selectorState.store = {
      sortie: { sortieMapId: 1 },
      battle: { _status: { result: { deckHp: [30] } } },
      const: { $ships: { 900: { api_stype: 5 } } },
    }
    selectorState.ships.set(1, [
      ship({
        api_ship_id: 500,
        api_stype: 2,
        api_luck: [30],
        api_kyouka: [0, 0, 0, 0, 5],
        api_lv: 99,
      }),
      {},
    ])
    selectorState.equips.set(1, [
      [equip({ id: 1, type2: 1 }), { api_name: 'gun' }],
      [equip({ id: 2, type2: 5 }), { api_name: 'torpedo' }],
      [equip({ id: 3, type2: 12, type3: 24, houm: 3, level: 4 }), { api_name: 'radar' }],
    ])
    const reporter = new NightBattleCIReporter()
    const report = attachReportSpy(reporter)

    reporter.processData({
      api_deck_id: 1,
      api_f_nowhps: [30],
      api_f_maxhps: [40],
      api_ship_ke: [0, 900],
      api_flare_pos: [1],
      api_hougeki: {
        api_at_eflag: [0],
        api_at_list: [0],
        api_df_list: [[1]],
        api_si_list: [[1, 2]],
        api_sp_list: [7],
        api_cl_list: [2],
        api_damage: [[10, -1, 5]],
      },
    }, 123456)

    expect(report).toHaveBeenCalledWith('/api/report/v2/night_battle_ci', {
      shipId: 500,
      type: 'DD',
      CI: 'DD_G_T_R',
      lv: 99,
      rawLuck: 35,
      pos: 0,
      status: 'yellow',
      items: [1, 2, 3],
      improvement: [0, 0, 4],
      searchLight: true,
      flare: 1,
      defenseId: 900,
      defenseTypeId: 5,
      ciType: 7,
      display: [1, 2],
      hitType: 2,
      damage: [10, -1, 5],
      damageTotal: 15,
      time: 123456,
    })
  })

  it('does not report cut-ins on event maps', () => {
    selectorState.store = {
      sortie: { sortieMapId: 101 },
      battle: { _status: { result: { deckHp: [] } } },
      const: { $ships: {} },
    }
    const reporter = new NightBattleCIReporter()
    const report = attachReportSpy(reporter)

    reporter.processData({ api_hougeki: {} }, 123456)

    expect(report).not.toHaveBeenCalled()
  })
})
