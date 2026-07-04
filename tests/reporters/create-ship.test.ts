import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachReportSpy,
  CreateShipReporter,
  resetReporterTestState,
} from '../helpers/reporter-test-harness'

beforeEach(resetReporterTestState)

describe('CreateShipReporter', () => {
  it('ignores kdock updates when no construction is pending', () => {
    const reporter = new CreateShipReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/kdock', [{ api_item1: 30 }], {})

    expect(report).not.toHaveBeenCalled()
  })

  it('waits for matching kdock data before reporting ship construction', () => {
    const reporter = new CreateShipReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/createship',
      {},
      {
        api_kdock_id: 2,
        api_item1: 30,
        api_item2: 31,
        api_item3: 32,
        api_item4: 33,
        api_item5: 1,
        api_large_flag: 1,
        api_highspeed: 0,
      },
    )
    reporter.handle('GET', '/kcsapi/api_get_member/kdock', [{}, { api_item1: 999 }], {})
    expect(report).not.toHaveBeenCalled()

    reporter.handle(
      'GET',
      '/kcsapi/api_get_member/kdock',
      [
        {},
        {
          api_item1: 30,
          api_item2: 31,
          api_item3: 32,
          api_item4: 33,
          api_item5: 1,
          api_created_ship_id: 400,
        },
      ],
      {},
    )

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

  it('reports invalid construction payloads instead of caching NaN dock state', () => {
    const reporter = new CreateShipReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.handle(
      'POST',
      '/kcsapi/api_req_kousyou/createship',
      {},
      {
        api_kdock_id: '2',
        api_item1: '30',
        api_item2: '31',
        api_item3: '32',
        api_item4: '33',
        api_large_flag: '1',
        api_highspeed: '0',
      },
    )

    expect(reporter.creating).toBe(false)
    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Invalid create ship report data')
    consoleError.mockRestore()
  })

  it('reports invalid construction secretary state instead of throwing', () => {
    window._ships = {}
    const reporter = new CreateShipReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      reporter.handle(
        'POST',
        '/kcsapi/api_req_kousyou/createship',
        {},
        {
          api_kdock_id: '2',
          api_item1: '30',
          api_item2: '31',
          api_item3: '32',
          api_item4: '33',
          api_item5: '1',
          api_large_flag: '1',
          api_highspeed: '0',
        },
      ),
    ).not.toThrow()

    expect(reporter.creating).toBe(false)
    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Invalid create ship secretary data')
    consoleError.mockRestore()
  })

  it('reports invalid kdock updates instead of throwing', () => {
    const reporter = new CreateShipReporter()
    const report = attachReportSpy(reporter)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    reporter.creating = true
    reporter.info = {
      items: [30, 31, 32, 33, 1],
      kdockId: 9,
      largeFlag: true,
      highspeed: 0,
      secretary: 101,
      teitokuLv: 120,
      shipId: -1,
    }
    reporter.kdockId = 9

    expect(() => reporter.handle('GET', '/kcsapi/api_get_member/kdock', [], {})).not.toThrow()

    expect(report).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Invalid kdock create ship report data')
    consoleError.mockRestore()
  })
})
