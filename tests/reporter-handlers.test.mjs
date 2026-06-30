import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import Module from 'node:module'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const originalLoad = Module._load

const selectorState = {
  store: {},
  ships: new Map(),
  equips: new Map(),
}

const aaciState = {
  getShipAACIs: vi.fn(() => []),
}

const momentState = {
  hour: 16,
  day: 2,
}

globalThis.window = {
  POI_VERSION: '10.7.0',
  SERVER_HOSTNAME: 'example.invalid',
  _decks: [],
  _ships: {},
  $ships: {},
  _slotitems: {},
  _teitokuId: 12345,
  _teitokuLv: 120,
  _nickName: 'Admiral',
  _nickNameId: 99,
  getStore: () => selectorState.store,
}

const sentryStub = {
  captureException() {},
  setContext() {},
  withScope(callback) {
    callback({ setTags() {} })
  },
}

Module._load = function loadReporterTestStub(request, parent, isMain) {
  switch (request) {
    case '@sentry/electron':
      return sentryStub
    case 'node-fetch':
      return async () => ({
        ok: true,
        json: async () => ({}),
        text: async () => '',
      })
    case 'moment-timezone':
      return {
        utc: () => ({
          hour: () => momentState.hour,
          day: () => momentState.day,
        }),
      }
    case 'views/utils/selectors':
      return {
        shipDataSelectorFactory: shipId => () => selectorState.ships.get(shipId),
        shipEquipDataSelectorFactory: shipId => () => selectorState.equips.get(shipId),
      }
    case 'views/utils/aaci':
      return aaciState
    default:
      return originalLoad.call(this, request, parent, isMain)
  }
}

const loadDefault = mod => mod.default || mod

const AACIReporter = loadDefault(require('../reporters/aaci.js'))
const CreateItemReporter = loadDefault(require('../reporters/create-item.js'))
const CreateShipReporter = loadDefault(require('../reporters/create-ship.js'))
const DropShipReporter = loadDefault(require('../reporters/drop-ship.js'))
const NightBattleCIReporter = loadDefault(require('../reporters/night-battle-ci.js'))
const NightContactReportor = loadDefault(require('../reporters/night-contact.js'))
const QuestReporter = loadDefault(require('../reporters/quest.js'))
const RemodelItemReporter = loadDefault(require('../reporters/remodel-item.js'))
const RemodelRecipeReporter = loadDefault(require('../reporters/remodel-recipe.js'))
const ShipStatReporter = loadDefault(require('../reporters/ship-stat.js'))

afterAll(() => {
  Module._load = originalLoad
})

const ship = overrides => ({
  api_ship_id: 100,
  api_lv: 50,
  api_cond: 49,
  api_slot: [],
  api_onslot: [],
  ...overrides,
})

const equip = ({ id = 0, type2 = 0, type3 = 0, level = 0, houm = 0 } = {}) => ({
  api_slotitem_id: id,
  api_type: [0, 0, type2, type3],
  api_level: level,
  api_houm: houm,
})

const attachReportSpy = reporter => {
  reporter.report = vi.fn(() => Promise.resolve())
  return reporter.report
}

const teitokuHash = () =>
  createHash('sha1')
    .update(`${window._teitokuId}_${window._nickName}_${window._nickNameId}`)
    .digest('base64')

beforeEach(() => {
  globalThis.window = {
    POI_VERSION: '10.7.0',
    SERVER_HOSTNAME: 'example.invalid',
    _decks: [{ api_ship: [1, 2] }],
    _ships: {
      1: ship({ api_ship_id: 101, api_lv: 80, api_cond: 53 }),
      2: ship({ api_ship_id: 102, api_lv: 70, api_cond: 49 }),
    },
    $ships: {
      101: { api_id: 101, api_yomi: 'alpha' },
      102: { api_id: 102, api_yomi: 'bravo' },
    },
    _slotitems: {},
    _teitokuId: 12345,
    _teitokuLv: 120,
    _nickName: 'Admiral',
    _nickNameId: 99,
    getStore: () => selectorState.store,
  }

  selectorState.store = {
    sortie: { sortieMapId: 1 },
    battle: { _status: { result: { deckHp: [] } } },
    const: { $ships: {} },
  }
  selectorState.ships.clear()
  selectorState.equips.clear()
  aaciState.getShipAACIs = vi.fn(() => [])
  momentState.hour = 16
  momentState.day = 2
})

describe('construction and remodel reporters', () => {
  it('ignores unrelated construction endpoints', () => {
    const itemReporter = new CreateItemReporter()
    const shipReporter = new CreateShipReporter()
    const itemReport = attachReportSpy(itemReporter)
    const shipReport = attachReportSpy(shipReporter)

    itemReporter.handle('POST', '/kcsapi/api_get_member/material', {}, {})
    shipReporter.handle('GET', '/kcsapi/api_get_member/kdock', [{ api_item1: 30 }], {})

    expect(itemReport).not.toHaveBeenCalled()
    expect(shipReport).not.toHaveBeenCalled()
  })

  it('reports every development result with resources, secretary, level, and success flag', () => {
    const reporter = new CreateItemReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/createitem',
      { api_get_items: [{ api_slotitem_id: 25 }, { api_slotitem_id: -1 }] },
      { api_item1: '10', api_item2: '20', api_item3: '30', api_item4: '40' },
    )

    expect(report).toHaveBeenCalledTimes(2)
    expect(report).toHaveBeenNthCalledWith(1, '/api/report/v2/create_item', {
      items: [10, 20, 30, 40],
      itemId: 25,
      teitokuLv: 120,
      secretary: 101,
      successful: true,
    })
    expect(report).toHaveBeenNthCalledWith(2, '/api/report/v2/create_item', {
      items: [10, 20, 30, 40],
      itemId: -1,
      teitokuLv: 120,
      secretary: 101,
      successful: false,
    })
  })

  it('waits for matching kdock data before reporting ship construction', () => {
    const reporter = new CreateShipReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_req_kousyou/createship', {}, {
      api_kdock_id: '2',
      api_item1: '30',
      api_item2: '31',
      api_item3: '32',
      api_item4: '33',
      api_item5: '1',
      api_large_flag: '1',
      api_highspeed: '0',
    })
    reporter.handle('GET', '/kcsapi/api_get_member/kdock', [{}, { api_item1: 999 }], {})
    expect(report).not.toHaveBeenCalled()

    reporter.handle('GET', '/kcsapi/api_get_member/kdock', [
      {},
      {
        api_item1: 30,
        api_item2: 31,
        api_item3: 32,
        api_item4: 33,
        api_item5: 1,
        api_created_ship_id: 400,
      },
    ])

    expect(report).toHaveBeenCalledWith('/api/report/v2/create_ship', {
      items: [30, 31, 32, 33, 1],
      kdockId: 1,
      largeFlag: true,
      highspeed: 0,
      secretary: 101,
      teitokuLv: 120,
      shipId: 400,
    })
  })

  it('reports remodel item attempts after matching detail state', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelItemReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', {}, {
      api_slot_id: 501,
    })
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slot', {
      api_remodel_flag: 1,
      api_remodel_id: [700],
    }, {
      api_slot_id: 501,
      api_certain_flag: 1,
    })

    expect(report).toHaveBeenCalledWith('/api/report/v2/remodel_item', {
      successful: 1,
      itemId: 700,
      itemLevel: 501,
      flagshipId: 101,
      flagshipLevel: 80,
      flagshipCond: 53,
      consortId: 102,
      consortLevel: 70,
      consortCond: 49,
      teitokuLv: 120,
      certain: 1,
    })
  })

  it('reports successful remodel recipes with cached recipe cost and day data', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', [{
      api_id: 33,
      api_req_fuel: 10,
      api_req_bull: 20,
      api_req_steel: 30,
      api_req_bauxite: 40,
    }])
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', {
      api_req_slot_id: 90,
      api_req_slot_num: 2,
      api_req_buildkit: 3,
      api_req_remodelkit: 4,
      api_certain_buildkit: 5,
      api_certain_remodelkit: 6,
    }, {
      api_id: '33',
      api_slot_id: 501,
    })
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slot', {
      api_remodel_flag: true,
      api_remodel_id: [700, 701],
      api_after_slot: { api_level: 0 },
      api_voice_ship_id: 99,
    }, {
      api_id: '33',
    })

    expect(report).toHaveBeenCalledWith('/api/report/v2/remodel_recipe', {
      recipeId: 33,
      itemId: 700,
      stage: 1,
      day: 3,
      secretary: 99,
      fuel: 10,
      ammo: 20,
      steel: 30,
      bauxite: 40,
      reqItemId: 90,
      reqItemCount: 2,
      buildkit: 3,
      remodelkit: 4,
      certainBuildkit: 5,
      certainRemodelkit: 6,
      upgradeToItemId: 701,
      upgradeToItemLevel: 0,
      key: 'r33-i700-s1-d3-s99',
    })
  })

  it('does not report failed remodel recipes or unknown item stages', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: -1 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', [{ api_id: 33 }])
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', {}, {
      api_id: '33',
      api_slot_id: 501,
    })
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slot', {
      api_remodel_flag: false,
      api_remodel_id: [700, 700],
    }, {
      api_id: '33',
    })
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slot', {
      api_remodel_flag: true,
      api_remodel_id: [700, 700],
    }, {
      api_id: '33',
    })

    expect(report).not.toHaveBeenCalled()
  })
})

describe('battle and drop reporters', () => {
  it('reports night contact when exactly one eligible plane is equipped', () => {
    window._decks = [{ api_ship: [1] }]
    window._ships[1] = ship({
      api_ship_id: 300,
      api_lv: 88,
      api_slot: [900, 901],
      api_onslot: [3, 0],
    })
    window._slotitems[900] = { api_slotitem_id: 102, api_level: 7 }
    const reporter = new NightContactReportor()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_req_sortie/battle', {
      api_midnight_flag: 1,
      api_kouku: { api_stage1: { api_f_count: 1, api_e_count: 0, api_disp_seiku: 1 } },
    })
    reporter.handle('POST', '/kcsapi/api_req_battle_midnight/battle', {
      api_deck_id: 1,
      api_touch_plane: [102, -1],
    })

    expect(report).toHaveBeenCalledWith('/api/report/v2/night_contcat', {
      fleetType: 0,
      shipId: 300,
      shipLv: 88,
      itemId: 102,
      itemLv: 7,
      contact: true,
    })
  })

  it('does not report night contact when multiple eligible planes are equipped', () => {
    window._decks = [{ api_ship: [1] }]
    window._ships[1] = ship({
      api_slot: [900, 901],
      api_onslot: [3, 1],
    })
    window._slotitems[900] = { api_slotitem_id: 102, api_level: 7 }
    window._slotitems[901] = { api_slotitem_id: 102, api_level: 3 }
    const reporter = new NightContactReportor()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_req_battle_midnight/sp_midnight', {
      api_deck_id: 1,
      api_touch_plane: [-1, -1],
    })

    expect(report).not.toHaveBeenCalled()
  })

  it('reports AACI availability and trigger details for exactly one available ship', () => {
    window._decks = [{ api_ship: [1, 2] }]
    selectorState.ships.set(1, [
      ship({
        api_ship_id: 400,
        api_luck: [20],
        api_kyouka: [0, 0, 5, 0, 3],
        api_tyku: [70],
        api_lv: 90,
        api_nowhp: 30,
        api_maxhp: 40,
      }),
      {},
    ])
    selectorState.ships.set(2, [ship({ api_ship_id: 401 }), {}])
    selectorState.equips.set(1, [
      [equip({ id: 10, level: 2 }), { api_name: 'gun' }],
      [equip({ id: 11, level: 0 }), { api_name: 'radar' }],
    ])
    selectorState.equips.set(2, [])
    aaciState.getShipAACIs = vi.fn(shipData => (shipData.api_ship_id === 400 ? [5] : []))
    const reporter = new AACIReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_req_sortie/battle', {
      api_deck_id: 1,
      api_kouku: {
        api_stage2: {
          api_e_count: 1,
          api_air_fire: { api_idx: 0, api_kind: 5 },
        },
      },
    })

    expect(report).toHaveBeenCalledWith('/api/report/v2/aaci', {
      poiVersion: '10.7.0',
      available: [5],
      triggered: 5,
      items: [10, 11],
      improvement: [2, 0],
      rawLuck: 23,
      rawTaiku: 75,
      lv: 90,
      hpPercent: 75,
      pos: 0,
    })
  })

  it('does not report AACI data when more than one ship has available cut-ins', () => {
    window._decks = [{ api_ship: [1, 2] }]
    selectorState.ships.set(1, [ship({ api_ship_id: 400 }), {}])
    selectorState.ships.set(2, [ship({ api_ship_id: 401 }), {}])
    selectorState.equips.set(1, [[equip({ id: 10 }), { api_name: 'gun' }]])
    selectorState.equips.set(2, [[equip({ id: 11 }), { api_name: 'gun' }]])
    aaciState.getShipAACIs = vi.fn(() => [5])
    const reporter = new AACIReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_req_sortie/battle', {
      api_deck_id: 1,
      api_kouku: { api_stage2: { api_e_count: 1 } },
    })

    expect(report).not.toHaveBeenCalled()
  })


  it('reports night battle cut-in payloads from battle state and API attack data', () => {
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

  it('does not report night battle cut-ins on event maps', () => {
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


  it('reports map rank, enemy info, drop results, and event pass rewards', async () => {
    window._ships = {
      1: ship({ api_ship_id: 101 }),
      2: ship({ api_ship_id: 102 }),
    }
    const reporter = new DropShipReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/mapinfo', {
      api_map_info: [{ api_id: 12, api_eventmap: { api_selected_rank: 3 } }],
    })
    reporter.handle('POST', '/kcsapi/api_req_map/select_eventmap_rank', {}, {
      api_maparea_id: '1',
      api_map_no: '2',
      api_rank: '4',
    })
    reporter.handle('POST', '/kcsapi/api_req_map/start', {
      api_maparea_id: 1,
      api_mapinfo_no: 2,
      api_no: 5,
      api_event_id: 5,
    })
    reporter.handle('POST', '/kcsapi/api_req_sortie/battle', {
      api_ship_ke: [0, 900],
      api_ship_lv: [0, 1],
      api_e_maxhps: [0, 30],
      api_eParam: [[0, 0, 0, 0]],
      api_eSlot: [[-1, -1, -1, -1]],
      api_formation: [1, 4],
      api_kouku: {
        api_stage1: { api_e_count: 12, api_e_lostcount: 2 },
        api_stage2: { api_e_count: 4 },
      },
    })
    reporter.handle('POST', '/kcsapi/api_req_sortie/battleresult', {
      api_enemy_info: { api_deck_name: 'Enemy Fleet' },
      api_quest_name: 'A Victory',
      api_win_rank: 'S',
      api_get_base_exp: 120,
      api_get_ship: { api_ship_id: 201 },
      api_get_useitem: { api_useitem_id: 301 },
      api_get_eventitem: [{ api_type: 1, api_id: 2, api_value: 3, api_slot_level: 4 }],
    })
    await Promise.resolve()

    expect(report).toHaveBeenNthCalledWith(1, '/api/report/v2/select_rank', {
      teitokuId: teitokuHash(),
      teitokuLv: 120,
      mapareaId: 12,
      rank: 4,
    })
    expect(report).toHaveBeenNthCalledWith(2, '/api/report/v2/enemy_info', {
      ships1: [0, 900],
      levels1: [0, 1],
      hp1: [0, 30],
      stats1: [[0, 0, 0, 0]],
      equips1: [[-1, -1, -1, -1]],
      ships2: [],
      levels2: [],
      hp2: [],
      stats2: [],
      equips2: [],
      planes: 12,
      bombersMin: 4,
      bombersMax: 6,
    })
    expect(report).toHaveBeenNthCalledWith(3, '/api/report/v2/drop_ship', expect.objectContaining({
      mapId: 12,
      cellId: 5,
      isBoss: true,
      mapLv: 4,
      enemy: 'Enemy Fleet',
      enemyShips1: [0, 900],
      enemyFormation: 4,
      baseExp: 120,
      quest: 'A Victory',
      rank: 'S',
      shipId: 201,
      itemId: 301,
      ownedShipSnapshot: { 101: [101], 102: [102] },
      teitokuLv: 120,
      teitokuId: teitokuHash(),
    }))
    expect(report).toHaveBeenNthCalledWith(4, '/api/report/v2/pass_event', {
      teitokuId: teitokuHash(),
      teitokuLv: 120,
      mapId: 12,
      mapLv: 4,
      rewards: [{ rewardType: 1, rewardId: 2, rewardCount: 3, rewardLevel: 4 }],
    })
  })
})

describe('quest and ship stat reporters', () => {
  it('reports unknown quests and selected quest rewards', () => {
    const reporter = new QuestReporter()
    reporter.enabled = true
    reporter.knownQuests = []
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/questlist', {
      api_list: [{
        api_no: 101,
        api_title: 'Sortie',
        api_detail: 'Win once',
        api_category: 2,
        api_type: 3,
      }],
    })
    expect(report).toHaveBeenCalledWith('/api/report/v3/quest', {
      quests: [{
        questId: 101,
        title: 'Sortie',
        detail: 'Win once',
        category: 2,
        type: 3,
      }],
    })

    report.mockClear()
    reporter.handle('POST', '/kcsapi/api_req_quest/clearitemget', {
      api_material: [1, 2, 3, 4],
      api_bounus: [{ api_type: 1 }],
      api_bounus_count: 1,
    }, {
      api_quest_id: '101',
      api_select_no: '3',
      api_select_no2: '7',
    })

    expect(report).toHaveBeenCalledWith('/api/report/v3/quest_reward', {
      selections: [3, 7],
      material: [1, 2, 3, 4],
      bonus: [{ api_type: 1 }],
      bounsCount: 1,
      questId: 101,
      title: 'Sortie',
      detail: 'Win once',
      category: 2,
      type: 3,
    })
  })

  it('does not report known quests again', () => {
    const reporter = new QuestReporter()
    reporter.enabled = true
    const knownHash = createHash('md5').update('SortieWin once').digest('hex')
    reporter.knownQuests = [knownHash.slice(0, 8)]
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/questlist', {
      api_list: [{
        api_no: 101,
        api_title: 'Sortie',
        api_detail: 'Win once',
        api_category: 2,
        api_type: 3,
      }],
    })

    expect(report).not.toHaveBeenCalled()
  })


  it('reports unequipped ship stats and ignores ships with equipped slots', () => {
    const reporter = new ShipStatReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/ship3', {
      api_ship_data: [{
        api_ship_id: 600,
        api_lv: 77,
        api_slot: [-1, -1, -1, -1],
        api_slot_ex: -1,
        api_kyouka: [0, 0, 0, 0, 0, 0, 9],
        api_sakuteki: [50, 80],
        api_taisen: [70, 100],
        api_kaihi: [60, 90],
      }],
    })
    expect(report).toHaveBeenCalledWith('/api/report/v2/ship_stat', {
      id: 600,
      lv: 77,
      los: 50,
      los_max: 80,
      asw: 61,
      asw_max: 100,
      evasion: 60,
      evasion_max: 90,
    })

    report.mockClear()
    reporter.handle('GET', '/kcsapi/api_get_member/ship3', {
      api_ship_data: [{
        api_slot: [10, -1, -1, -1],
        api_slot_ex: -1,
        api_kyouka: [],
      }],
    })
    expect(report).not.toHaveBeenCalled()
  })
})
