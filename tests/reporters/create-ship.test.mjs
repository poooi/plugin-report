import { beforeEach, describe, expect, it } from 'vitest'

import {
  attachReportSpy,
  CreateShipReporter,
  resetReporterTestState,
} from '../helpers/reporter-test-harness.mjs'

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
})
