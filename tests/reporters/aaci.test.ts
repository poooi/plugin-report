import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AACIReporter,
  aaciState,
  attachReportSpy,
  equip,
  resetReporterTestState,
  selectorState,
  ship,
} from '../helpers/reporter-test-harness'

beforeEach(resetReporterTestState)

describe('AACIReporter', () => {
  it('does not report when the runtime AACI helper is unavailable', () => {
    const reporter = new AACIReporter()
    reporter.getShipAACIs = null
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_sortie/battle',
      {
        api_deck_id: 1,
        api_kouku: { api_stage2: { api_e_count: 1 } },
      },
      {},
    )

    expect(report).not.toHaveBeenCalled()
  })

  it('does not report when the deck is missing or no enemy planes are present', () => {
    const reporter = new AACIReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_sortie/battle',
      {
        api_deck_id: 2,
        api_kouku: { api_stage2: { api_e_count: 1 } },
      },
      {},
    )
    window._decks = [{ api_ship: [1] }]
    selectorState.ships.set(1, [ship({ api_ship_id: 400 }), {}])
    selectorState.equips.set(1, [[equip({ id: 10 }), { api_name: 'gun' }]])
    aaciState.getShipAACIs = vi.fn(() => [5])
    reporter.handle(
      'POST',
      '/kcsapi/api_req_sortie/battle',
      {
        api_deck_id: 1,
        api_kouku: { api_stage2: { api_e_count: 0 } },
      },
      {},
    )

    expect(report).not.toHaveBeenCalled()
  })

  it('reports availability and trigger details for exactly one available ship', () => {
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
    aaciState.getShipAACIs = vi.fn((shipData) => (shipData.api_ship_id === 400 ? [5] : []))
    const reporter = new AACIReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_sortie/battle',
      {
        api_deck_id: 1,
        api_kouku: {
          api_stage2: {
            api_e_count: 1,
            api_air_fire: { api_idx: 0, api_kind: 5 },
          },
        },
      },
      {},
    )

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

  it('does not report when more than one ship has available cut-ins', () => {
    window._decks = [{ api_ship: [1, 2] }]
    selectorState.ships.set(1, [ship({ api_ship_id: 400 }), {}])
    selectorState.ships.set(2, [ship({ api_ship_id: 401 }), {}])
    selectorState.equips.set(1, [[equip({ id: 10 }), { api_name: 'gun' }]])
    selectorState.equips.set(2, [[equip({ id: 11 }), { api_name: 'gun' }]])
    aaciState.getShipAACIs = vi.fn(() => [5])
    const reporter = new AACIReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_sortie/battle',
      {
        api_deck_id: 1,
        api_kouku: { api_stage2: { api_e_count: 1 } },
      },
      {},
    )

    expect(report).not.toHaveBeenCalled()
  })

  it('reports available AACI data when trigger fields are omitted', () => {
    window._decks = [{ api_ship: [1] }]
    selectorState.ships.set(1, [
      ship({
        api_ship_id: 400,
        api_luck: [20],
        api_kyouka: [0, 0, 5, 0, 3],
        api_tyku: [70],
        api_lv: 90,
        api_nowhp: 20,
        api_maxhp: 40,
      }),
      {},
    ])
    selectorState.equips.set(1, [[equip({ id: 10 }), { api_name: 'gun' }]])
    aaciState.getShipAACIs = vi.fn(() => [7])
    const reporter = new AACIReporter()
    const report = attachReportSpy(reporter)

    reporter.handle(
      'POST',
      '/kcsapi/api_req_sortie/battle',
      {
        api_deck_id: 1,
        api_kouku: { api_stage2: { api_e_count: 1 } },
      },
      {},
    )

    expect(report).toHaveBeenCalledWith(
      '/api/report/v2/aaci',
      expect.objectContaining({
        available: [7],
        triggered: undefined,
        hpPercent: 50,
        pos: undefined,
      }),
    )
  })
})
