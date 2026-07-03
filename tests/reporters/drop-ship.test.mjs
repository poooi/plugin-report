import { beforeEach, describe, expect, it } from 'vitest'

import {
  attachReportSpy,
  DropShipReporter,
  resetReporterTestState,
  ship,
  teitokuHash,
} from '../helpers/reporter-test-harness.mjs'

beforeEach(resetReporterTestState)

describe('DropShipReporter', () => {
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
    reporter.handle(
      'POST',
      '/kcsapi/api_req_map/select_eventmap_rank',
      {},
      {
        api_maparea_id: '1',
        api_map_no: '2',
        api_rank: '4',
      },
    )
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
    expect(report).toHaveBeenNthCalledWith(
      3,
      '/api/report/v2/drop_ship',
      expect.objectContaining({
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
      }),
    )
    expect(report).toHaveBeenNthCalledWith(4, '/api/report/v2/pass_event', {
      teitokuId: teitokuHash(),
      teitokuLv: 120,
      mapId: 12,
      mapLv: 4,
      rewards: [{ rewardType: 1, rewardId: 2, rewardCount: 3, rewardLevel: 4 }],
    })
  })

  it('reports air raid enemy info and handles absent event rewards', async () => {
    const reporter = new DropShipReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_req_map/start', {
      api_maparea_id: 2,
      api_mapinfo_no: 3,
      api_no: 4,
      api_event_id: 1,
      api_destruction_battle: {
        api_ship_ke: [0, 800],
        api_kouku: {
          api_stage1: { api_e_count: 3, api_e_lostcount: 1 },
          api_stage2: { api_e_count: 2 },
        },
      },
    })
    reporter.handle('POST', '/kcsapi/api_req_sortie/battleresult', {
      api_enemy_info: { api_deck_name: 'No Drop' },
      api_quest_name: '',
      api_win_rank: 'A',
      api_get_base_exp: 50,
    })
    await Promise.resolve()

    expect(report).toHaveBeenNthCalledWith(
      1,
      '/api/report/v2/enemy_info',
      expect.objectContaining({
        ships1: [0, 800],
        planes: 3,
        bombersMin: 2,
        bombersMax: 3,
      }),
    )
    expect(report).toHaveBeenCalledWith(
      '/api/report/v2/drop_ship',
      expect.objectContaining({
        mapId: 23,
        isBoss: false,
        shipId: -1,
        itemId: -1,
      }),
    )
    expect(report).toHaveBeenCalledTimes(2)
  })
})
