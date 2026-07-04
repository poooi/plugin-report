import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearRemodelDebugRecords,
  createRemodelDebugRecord,
  getRemodelDebugRecords,
  recordRemodelDebugEvent,
} from '../src/remodel-debug-recorder'
import type { GameResponseEventDetail } from '../src/types/game-api'

const storage = new Map<string, string>()

const createWindow = () =>
  ({
    localStorage: {
      getItem(key: string) {
        return storage.get(key) ?? null
      },
      setItem(key: string, value: string) {
        storage.set(key, value)
      },
      removeItem(key: string) {
        storage.delete(key)
      },
    },
    _decks: [{ api_ship: [1, 2, 3] }],
    _ships: {
      1: { api_ship_id: 101, api_lv: 80 },
      2: { api_ship_id: 102, api_lv: 70 },
      3: { api_ship_id: 103, api_lv: 60 },
    },
    _slotitems: {
      501: { api_slotitem_id: 700, api_level: 6, api_locked: 1 },
    },
  }) as unknown as Window & typeof globalThis

const remodelDetailEvent: GameResponseEventDetail = {
  time: 1710000000000,
  method: 'POST',
  path: '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
  postBody: {
    api_id: '33',
    api_slot_id: '501',
    api_token: 'secret-token',
  },
  body: {
    api_req_buildkit: 3,
    api_token: 'secret-token',
  },
}

beforeEach(() => {
  storage.clear()
  globalThis.window = createWindow()
  clearRemodelDebugRecords()
})

describe('remodel debug recorder', () => {
  it('does not record unless explicitly enabled', () => {
    recordRemodelDebugEvent(remodelDetailEvent)

    expect(getRemodelDebugRecords()).toHaveLength(0)
  })

  it('records only remodel APIs when enabled', () => {
    window.localStorage.setItem('poi-plugin-report:remodel-debug-recorder', '1')

    recordRemodelDebugEvent({
      ...remodelDetailEvent,
      path: '/kcsapi/api_get_member/ship2',
    })
    recordRemodelDebugEvent(remodelDetailEvent)

    expect(getRemodelDebugRecords()).toHaveLength(1)
  })

  it('sanitizes fleet and slot context for captured remodel records', () => {
    const record = createRemodelDebugRecord(remodelDetailEvent)

    expect(record).toEqual({
      time: 1710000000000,
      method: 'POST',
      path: '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
      postBody: {
        api_id: '33',
      },
      body: {
        api_req_buildkit: 3,
      },
      context: {
        firstFleet: {
          flagship: {
            api_ship_id: 101,
          },
          secondShip: {
            api_ship_id: 102,
          },
        },
        selectedSlotItem: {
          api_slotitem_id: 700,
          api_level: 6,
        },
      },
    })
  })
})
