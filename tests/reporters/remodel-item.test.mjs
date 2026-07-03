import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachReportSpy,
  RemodelItemReporter,
  resetReporterTestState,
} from '../helpers/reporter-test-harness.mjs'

beforeEach(resetReporterTestState)

describe('RemodelItemReporter', () => {
  it('reports remodel item attempts after matching detail state', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelItemReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {},
      {
        api_slot_id: 501,
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: 1,
        api_remodel_id: [700],
      },
      {
        api_slot_id: 501,
        api_certain_flag: 1,
      },
    )

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

  it('does not report when remodel slot response mismatches cached detail state', () => {
    window._slotitems[501] = { api_slotitem_id: 700, api_level: 6 }
    const reporter = new RemodelItemReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      {},
      {
        api_slot_id: 501,
      },
    )
    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/remodel_slot',
      {
        api_remodel_flag: 1,
        api_remodel_id: [700],
      },
      {
        api_slot_id: 999,
      },
    )

    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Inconsistent remodel item data: 501, 999')
    consoleError.mockRestore()
  })

  it('reports invalid remodel secretary state instead of throwing', () => {
    const reporter = new RemodelItemReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.itemId = 501
    window._ships = {}

    expect(() =>
      reporter.handle(
        'POST',
        '/kcsapi/api_req_kousyou/remodel_slot',
        {
          api_remodel_flag: 1,
          api_remodel_id: [700],
        },
        {
          api_slot_id: 501,
          api_certain_flag: 1,
        },
      ),
    ).not.toThrow()

    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Invalid remodel item secretary data')
    consoleError.mockRestore()
  })
})
