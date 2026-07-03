import { beforeEach, describe, expect, it } from 'vitest'

import {
  attachReportSpy,
  equip,
  NightBattleCIReporter,
  resetReporterTestState,
  selectorState,
  ship,
} from '../helpers/reporter-test-harness'

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

    reporter.processData(
      {
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
      },
      123456,
    )

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

  it('reports submarine cut-ins with scalar display equipment', () => {
    window._decks = [{ api_ship: [1] }]
    selectorState.store = {
      sortie: { sortieMapId: 1 },
      battle: { _status: { result: { deckHp: [20] } } },
      const: { $ships: { 901: { api_stype: 13 } } },
    }
    selectorState.ships.set(1, [
      ship({
        api_ship_id: 501,
        api_stype: 13,
        api_luck: [10],
        api_kyouka: [0, 0, 0, 0, 1],
        api_lv: 80,
      }),
      {},
    ])
    selectorState.equips.set(1, [
      [equip({ id: 213 }), { api_name: 'torpedo' }],
      [equip({ id: 214 }), { api_name: 'torpedo' }],
    ])
    const reporter = new NightBattleCIReporter()
    const report = attachReportSpy(reporter)

    reporter.processData(
      {
        api_deck_id: 1,
        api_f_nowhps: [20],
        api_f_maxhps: [40],
        api_ship_ke: [0, 901],
        api_flare_pos: [-1],
        api_hougeki: {
          api_at_eflag: [0],
          api_at_list: [0],
          api_df_list: [[1]],
          api_si_list: [213],
          api_sp_list: [9],
          api_cl_list: [1],
          api_damage: [[4]],
        },
      },
      789,
    )

    expect(report).toHaveBeenCalledWith(
      '/api/report/v2/night_battle_ci',
      expect.objectContaining({
        type: 'SS',
        CI: 'SS_LMT_LMT',
        display: [213],
        damageTotal: 4,
      }),
    )
  })

  it('reports valid carrier cut-ins and skips invalid carrier night attacks', () => {
    window._decks = [{ api_ship: [1, 2] }]
    selectorState.store = {
      sortie: { sortieMapId: 1 },
      battle: { _status: { result: { deckHp: [30, 30] } } },
      const: { $ships: { 902: { api_stype: 2 } } },
    }
    selectorState.ships.set(1, [
      ship({
        api_ship_id: 545,
        api_stype: 7,
        api_luck: [15],
        api_kyouka: [0, 0, 0, 0, 0],
        api_lv: 90,
      }),
      {},
    ])
    selectorState.ships.set(2, [
      ship({
        api_ship_id: 600,
        api_stype: 7,
        api_luck: [15],
        api_kyouka: [0, 0, 0, 0, 0],
        api_lv: 90,
      }),
      {},
    ])
    selectorState.equips.set(1, [
      [equip({ id: 154, type3: 45 }), { api_name: 'night fighter' }],
      [equip({ id: 320 }), { api_name: 'suisei' }],
    ])
    selectorState.equips.set(2, [
      [equip({ id: 154, type3: 45 }), { api_name: 'night fighter' }],
      [equip({ id: 320 }), { api_name: 'suisei' }],
    ])
    const reporter = new NightBattleCIReporter()
    const report = attachReportSpy(reporter)

    reporter.processData(
      {
        api_deck_id: 1,
        api_f_nowhps: [30, 30],
        api_f_maxhps: [40, 40],
        api_ship_ke: [0, 902],
        api_flare_pos: [-1],
        api_hougeki: {
          api_at_eflag: [0, 0],
          api_at_list: [0, 1],
          api_df_list: [[1], [1]],
          api_si_list: [[154], [154]],
          api_sp_list: [1, 1],
          api_cl_list: [1, 1],
          api_damage: [[5], [6]],
        },
      },
      456,
    )

    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith(
      '/api/report/v2/night_battle_ci',
      expect.objectContaining({
        shipId: 545,
        type: 'CV',
        CI: 'CV_NF_B_S',
      }),
    )
  })

  it('skips cut-ins when HP status changes or no player attack order exists', () => {
    window._decks = [{ api_ship: [1] }]
    selectorState.store = {
      sortie: { sortieMapId: 1 },
      battle: { _status: { result: { deckHp: [5] } } },
      const: { $ships: { 900: { api_stype: 5 } } },
    }
    selectorState.ships.set(1, [
      ship({ api_ship_id: 500, api_stype: 2, api_luck: [30], api_kyouka: [0, 0, 0, 0, 5] }),
      {},
    ])
    selectorState.equips.set(1, [
      [equip({ type2: 1 }), {}],
      [equip({ type2: 5 }), {}],
      [equip({ type2: 12, houm: 3 }), {}],
    ])
    const reporter = new NightBattleCIReporter()
    const report = attachReportSpy(reporter)
    const body = {
      api_deck_id: 1,
      api_f_nowhps: [30],
      api_f_maxhps: [40],
      api_ship_ke: [0, 900],
      api_flare_pos: [-1],
      api_hougeki: {
        api_at_eflag: [0],
        api_at_list: [0],
        api_df_list: [[1]],
        api_si_list: [[1]],
        api_sp_list: [1],
        api_cl_list: [1],
        api_damage: [[1]],
      },
    }

    reporter.processData(body, 1)
    selectorState.store.battle._status.result.deckHp = [30]
    reporter.processData(
      {
        ...body,
        api_hougeki: { ...body.api_hougeki, api_at_eflag: [1] },
      },
      1,
    )

    expect(report).not.toHaveBeenCalled()
  })
})
