import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachReportSpy,
  CreateItemReporter,
  resetReporterTestState,
} from '../helpers/reporter-test-harness'

beforeEach(resetReporterTestState)

describe('CreateItemReporter', () => {
  it('ignores unrelated endpoints', () => {
    const reporter = new CreateItemReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('POST', '/kcsapi/api_get_member/material', {}, {})

    expect(report).not.toHaveBeenCalled()
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

  it('reports invalid development payloads instead of throwing or sending NaN data', () => {
    const reporter = new CreateItemReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      reporter.handle(
        'POST',
        '/kcsapi/api_req_kousyou/createitem',
        { api_get_items: [{ api_slotitem_id: 25 }] },
        { api_item1: '10', api_item2: '20', api_item3: '30' },
      ),
    ).not.toThrow()

    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Invalid create item report data')
    consoleError.mockRestore()
  })

  it('reports invalid secretary state instead of throwing', () => {
    window._ships = {}
    const reporter = new CreateItemReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      reporter.handle(
        'POST',
        '/kcsapi/api_req_kousyou/createitem',
        { api_get_items: [{ api_slotitem_id: 25 }] },
        { api_item1: '10', api_item2: '20', api_item3: '30', api_item4: '40' },
      ),
    ).not.toThrow()

    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Invalid create item secretary data')
    consoleError.mockRestore()
  })
})
