import { beforeEach, describe, expect, it } from 'vitest'

import {
  attachReportSpy,
  NightContactReportor,
  resetReporterTestState,
  ship,
} from '../helpers/reporter-test-harness.mjs'

beforeEach(resetReporterTestState)

describe('NightContactReportor', () => {
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

  it('does not throw when air battle stage data is absent', () => {
    const reporter = new NightContactReportor()
    const report = attachReportSpy(reporter)

    expect(() =>
      reporter.handle('POST', '/kcsapi/api_req_sortie/battle', {
        api_midnight_flag: 1,
        api_kouku: {},
      }),
    ).not.toThrow()

    expect(reporter.isValid).toBe(false)
    expect(report).not.toHaveBeenCalled()
  })
})
