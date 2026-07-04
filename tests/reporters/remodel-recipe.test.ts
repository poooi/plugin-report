import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachReportSpy,
  RemodelRecipeReporter,
  resetReporterTestState,
} from '../helpers/reporter-test-harness'

const fixedTestTime = Date.UTC(2026, 6, 3, 15)

beforeEach(() => {
  resetReporterTestState()
  vi.useFakeTimers()
  vi.setSystemTime(fixedTestTime)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RemodelRecipeReporter', () => {
  const detailBody = {
    api_req_slot_id: 90,
    api_req_slot_num: 2,
    api_req_buildkit: 3,
    api_req_remodelkit: 4,
    api_certain_buildkit: 5,
    api_certain_remodelkit: 6,
  }

  const listBody = [
    {
      api_id: 33,
      api_slot_id: 700,
      api_req_fuel: 10,
      api_req_bull: 20,
      api_req_steel: 30,
      api_req_bauxite: 40,
    },
  ]
  const detailTime = fixedTestTime
  const executionTime = Date.UTC(2026, 6, 4, 15)

  it('reports v3 availability and detail facts without execution', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 0 }
    window._decks[0] = { api_ship: [1, -1] }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'GET',
      '/kcsapi/api_req_kousyou/remodel_slotlist',
      listBody,
      {},
      Date.UTC(2026, 6, 3, 14),
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {
        ...detailBody,
        api_req_slot_id2: 90,
        api_req_slot_num2: 1,
        api_req_useitem_id: 65,
        api_req_useitem_num: 1,
        api_req_useitem_id2: 66,
        api_req_useitem_num2: 2,
        api_change_flag: 0,
      },
      {
        api_id: '33',
        api_slot_id: 501,
      },
      Date.UTC(2026, 6, 3, 15),
    )

    expect(report).toHaveBeenNthCalledWith(1, '/api/report/v3/item_improvement_recipe', {
      records: [
        {
          schemaVersion: 1,
          source: 'list',
          clientObservedAt: Date.UTC(2026, 6, 3, 14),
          recipeId: 33,
          itemId: 700,
          day: 5,
          observedSecondShipId: 0,
          observedFlagshipId: 101,
          detailObserved: false,
        },
      ],
    })
    expect(report).toHaveBeenNthCalledWith(2, '/api/report/v3/item_improvement_recipe', {
      schemaVersion: 1,
      source: 'detail',
      clientObservedAt: Date.UTC(2026, 6, 3, 15),
      recipeId: 33,
      itemId: 700,
      itemLevel: 0,
      stage: 0,
      day: 6,
      observedSecondShipId: 0,
      observedFlagshipId: 101,
      fuel: 10,
      ammo: 20,
      steel: 30,
      bauxite: 40,
      buildkit: 3,
      remodelkit: 4,
      certainBuildkit: 5,
      certainRemodelkit: 6,
      reqSlotItems: [{ id: 90, count: 3 }],
      reqUseItems: [
        { id: 65, count: 1 },
        { id: 66, count: 2 },
      ],
      changeFlag: 0,
      detailObserved: true,
    })
    expect(report).toHaveBeenCalledTimes(2)
  })

  it('reports successful remodel recipes with cached recipe cost and day data', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody, {}, detailTime)
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      detailBody,
      {
        api_id: '33',
        api_slot_id: 501,
      },
      detailTime,
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
      executionTime,
    )

    expect(report).toHaveBeenCalledWith('/api/report/v2/remodel_recipe', {
      recipeId: 33,
      itemId: 700,
      stage: 1,
      day: 6,
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
      key: 'r33-i700-s1-d6-s99',
    })
    expect(report).toHaveBeenCalledWith('/api/report/v3/item_improvement_recipe', {
      schemaVersion: 1,
      source: 'execution',
      clientObservedAt: executionTime,
      recipeId: 33,
      itemId: 700,
      itemLevel: 6,
      day: 0,
      observedSecondShipId: 102,
      observedFlagshipId: 101,
      upgradeObserved: true,
      upgradeToItemId: 701,
      upgradeToItemLevel: 0,
    })
  })

  it('does not report v3 update facts for failed or non-converting improvements', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', detailBody, {
      api_id: '33',
      api_slot_id: 501,
    })
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

    expect(report).not.toHaveBeenCalledWith(
      '/api/report/v3/item_improvement_recipe',
      expect.objectContaining({ source: 'execution' }),
    )
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
    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', detailBody, {
      api_id: '33',
      api_slot_id: 501,
    })
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

    expect(report).not.toHaveBeenCalledWith('/api/report/v2/remodel_recipe', expect.anything())
    expect(report).not.toHaveBeenCalledWith(
      '/api/report/v3/item_improvement_recipe',
      expect.objectContaining({ source: 'execution' }),
    )
    expect(consoleError).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  it('skips v3 reporting when fleet context is unknown', () => {
    window._decks = []
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)

    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Invalid remodel recipe fleet context')
    consoleError.mockRestore()
  })

  it('rejects malformed required item pairs', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {
        ...detailBody,
        api_req_useitem_id: 65,
        api_req_useitem_num: 0,
      },
      {
        api_id: '33',
        api_slot_id: 501,
      },
    )

    expect(report).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith('Invalid required item pair: 65/0')
    consoleError.mockRestore()
  })

  it('rejects detail observations without exact costs or slot item state', () => {
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', detailBody, {
      api_id: '33',
      api_slot_id: 501,
    })
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {},
      {
        api_id: '33',
        api_slot_id: 501,
      },
    )

    expect(report).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith('Invalid remodel recipe slot item data')
    expect(consoleError).toHaveBeenCalledWith('Invalid remodel recipe detail data')
    consoleError.mockRestore()
  })

  it('rejects placeholder item ids in detail observations', () => {
    window._slotitems[501] = { api_slotitem_id: 0, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', detailBody, {
      api_id: '33',
      api_slot_id: 501,
    })

    expect(report).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith('Invalid remodel recipe slot item data')
    consoleError.mockRestore()
  })

  it('rejects execution when the request slot mismatches cached detail state', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', detailBody, {
      api_id: '33',
      api_slot_id: 501,
    })
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
        api_slot_id: 999,
      },
    )

    expect(report).not.toHaveBeenCalledWith('/api/report/v2/remodel_recipe', expect.anything())
    expect(consoleError).toHaveBeenCalledWith('Inconsistent remodel item data: 501, 999')
    consoleError.mockRestore()
  })

  it('logs item id mismatches without mixing item and slot identifiers', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', detailBody, {
      api_id: '33',
      api_slot_id: 501,
    })
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: true,
        api_remodel_id: [999, 701],
      },
      {
        api_id: '33',
        api_slot_id: 501,
      },
    )

    expect(report).not.toHaveBeenCalledWith('/api/report/v2/remodel_recipe', expect.anything())
    expect(consoleError).toHaveBeenCalledWith(
      'Inconsistent remodel item data: expected item 700, got 999',
    )
    consoleError.mockRestore()
  })

  it('preserves v2 execution reporting when v3 fleet context is unavailable', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    window._decks = []
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle('POST', '/kcsapi/api_req_kousyou/remodel_slotlist_detail', detailBody, {
      api_id: '33',
      api_slot_id: 501,
    })
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

    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith(
      '/api/report/v2/remodel_recipe',
      expect.objectContaining({
        recipeId: 33,
        itemId: 700,
        upgradeToItemId: 701,
      }),
    )
    expect(consoleError).toHaveBeenCalledWith('Invalid remodel recipe fleet context')
    consoleError.mockRestore()
  })

  it('uses api_after_slot item id for conversion targets when remodel id is unchanged', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 10 }
    const reporter = new RemodelRecipeReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_req_kousyou/remodel_slotlist', listBody)
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {
        ...detailBody,
        api_change_flag: 1,
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
        api_remodel_id: [700, 700],
        api_after_slot: { api_slotitem_id: 701, api_level: 0 },
        api_voice_ship_id: 99,
      },
      {
        api_id: '33',
      },
    )

    expect(report).toHaveBeenCalledWith(
      '/api/report/v3/item_improvement_recipe',
      expect.objectContaining({
        source: 'execution',
        upgradeToItemId: 701,
        upgradeToItemLevel: 0,
      }),
    )
  })
})
