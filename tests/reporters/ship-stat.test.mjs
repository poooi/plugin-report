import { beforeEach, describe, expect, it } from 'vitest'

import {
  attachReportSpy,
  resetReporterTestState,
  ShipStatReporter,
} from '../helpers/reporter-test-harness.mjs'

beforeEach(resetReporterTestState)

describe('ShipStatReporter', () => {
  it('reports unequipped ship stats and ignores ships with equipped slots', () => {
    const reporter = new ShipStatReporter()
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/ship3', {
      api_ship_data: [
        {
          api_ship_id: 600,
          api_lv: 77,
          api_slot: [-1, -1, -1, -1],
          api_slot_ex: -1,
          api_kyouka: [0, 0, 0, 0, 0, 0, 9],
          api_sakuteki: [50, 80],
          api_taisen: [70, 100],
          api_kaihi: [60, 90],
        },
      ],
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
      api_ship_data: [
        {
          api_slot: [10, -1, -1, -1],
          api_slot_ex: -1,
          api_kyouka: [],
        },
      ],
    })
    expect(report).not.toHaveBeenCalled()
  })
})
