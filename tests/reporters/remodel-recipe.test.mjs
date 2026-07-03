import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachReportSpy,
  RemodelRecipeReporter,
  resetReporterTestState,
} from '../helpers/reporter-test-harness.mjs'

beforeEach(resetReporterTestState)

describe('RemodelRecipeReporter', () => {
  it('reports successful remodel recipes with cached recipe cost and day data', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', [
      {
        api_id: 33,
        api_req_fuel: 10,
        api_req_bull: 20,
        api_req_steel: 30,
        api_req_bauxite: 40,
      },
    ])
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {
        api_req_slot_id: 90,
        api_req_slot_num: 2,
        api_req_buildkit: 3,
        api_req_remodelkit: 4,
        api_certain_buildkit: 5,
        api_certain_remodelkit: 6,
      },
      {
        api_id: '33',
        api_slot_id: 501,
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: true,
        api_remodel_id: [700, 701],
        api_after_slot: { api_level: 0 },
        api_voice_ship_id: 99,
      },
      {
        api_id: '33',
      },
    )

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
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {},
      {
        api_id: '33',
        api_slot_id: 501,
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: false,
        api_remodel_id: [700, 700],
      },
      {
        api_id: '33',
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: true,
        api_remodel_id: [700, 700],
      },
      {
        api_id: '33',
      },
    )

    expect(report).not.toHaveBeenCalled()
  })

  it('does not cache detail state before recipe list or when upgrade responses mismatch', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {},
      {
        api_id: '33',
        api_slot_id: 501,
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: true,
        api_remodel_id: [700, 701],
      },
      {
        api_id: '33',
      },
    )
    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', [{ api_id: 33 }])
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {},
      {
        api_id: '33',
        api_slot_id: 501,
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: true,
        api_remodel_id: [999, 701],
      },
      {
        api_id: '33',
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: true,
        api_remodel_id: [700, 701],
      },
      {
        api_id: '34',
      },
    )

    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })
})
