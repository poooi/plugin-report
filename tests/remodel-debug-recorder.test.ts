import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearRemodelDebugRecords,
  createRemodelDebugRecord,
  getRemodelDebugRecords,
  recordRemodelDebugEvent,
  setRemodelDebugRecorderEnabled,
  subscribeRemodelDebugRecorder,
  exportRemodelDebugRecords,
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
  setRemodelDebugRecorderEnabled(false)
  clearRemodelDebugRecords()
})

describe('remodel debug recorder', () => {
  it('does not record unless explicitly enabled', () => {
    recordRemodelDebugEvent(remodelDetailEvent)

    expect(getRemodelDebugRecords()).toHaveLength(0)
  })

  it('ignores unrelated APIs before checking localStorage', () => {
    const getItem = vi.fn(() => '1')
    globalThis.window = {
      ...createWindow(),
      localStorage: {
        getItem,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    } as unknown as Window & typeof globalThis

    recordRemodelDebugEvent({
      ...remodelDetailEvent,
      path: '/kcsapi/api_get_member/ship2',
    })

    expect(getItem).not.toHaveBeenCalled()
    expect(getRemodelDebugRecords()).toHaveLength(0)
  })

  it('does not create records for unrelated APIs', () => {
    expect(
      createRemodelDebugRecord({
        ...remodelDetailEvent,
        path: '/kcsapi/api_get_member/ship2',
      }),
    ).toBeUndefined()
  })

  it('records only remodel APIs when enabled', () => {
    setRemodelDebugRecorderEnabled(true)

    recordRemodelDebugEvent({
      ...remodelDetailEvent,
      path: '/kcsapi/api_get_member/ship2',
    })
    recordRemodelDebugEvent(remodelDetailEvent)

    expect(getRemodelDebugRecords()).toHaveLength(1)
  })

  it('caches enabled state after the first storage read', () => {
    const getItem = vi.fn(() => '1')
    globalThis.window = {
      ...createWindow(),
      localStorage: {
        getItem,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    } as unknown as Window & typeof globalThis
    setRemodelDebugRecorderEnabled(true)

    recordRemodelDebugEvent(remodelDetailEvent)
    recordRemodelDebugEvent(remodelDetailEvent)

    expect(getItem).not.toHaveBeenCalled()
    expect(getRemodelDebugRecords()).toHaveLength(2)
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

  it('keeps boolean remodel flags in slot execution captures', () => {
    const record = createRemodelDebugRecord({
      time: 1710000000001,
      method: 'POST',
      path: '/kcsapi/api_req_kousyou/remodel_slot',
      postBody: {
        api_id: '33',
        api_slot_id: '501',
        api_token: 'secret-token',
      },
      body: {
        api_remodel_flag: true,
        api_remodel_id: [700, 701],
        api_after_slot: {
          api_slotitem_id: 701,
          api_level: 0,
        },
      },
    })

    expect(record).toMatchObject({
      postBody: {
        api_id: '33',
      },
      body: {
        api_remodel_flag: true,
      },
    })
  })

  it('sanitizes malformed list and slot response shapes', () => {
    expect(
      createRemodelDebugRecord({
        time: 1,
        method: 'GET',
        path: '/kcsapi/api_req_kousyou/remodel_slotlist',
        postBody: null as unknown as GameResponseEventDetail['postBody'],
        body: [
          {
            api_id: 33,
            api_slot_id: 700,
            api_req_fuel: 10,
            api_req_bull: 20,
            api_req_steel: 30,
            api_req_bauxite: 40,
            api_token: 'secret-token',
          },
          null,
        ],
      }),
    ).toMatchObject({
      body: [
        {
          api_id: 33,
          api_slot_id: 700,
          api_req_fuel: 10,
          api_req_bull: 20,
          api_req_steel: 30,
          api_req_bauxite: 40,
        },
        {},
      ],
      postBody: {},
    })
    expect(
      createRemodelDebugRecord({
        time: 2,
        method: 'POST',
        path: '/kcsapi/api_req_kousyou/remodel_slot',
        postBody: {
          api_id: '33',
        },
        body: {
          api_after_slot: null,
          api_remodel_flag: 1,
          api_remodel_id: ['bad', 701],
        },
      }),
    ).toMatchObject({
      body: {
        api_after_slot: {},
        api_remodel_flag: 1,
        api_remodel_id: [701],
      },
    })
  })

  it('handles missing deck ship arrays while recording', () => {
    window._decks = [{} as (typeof window._decks)[number]]

    expect(() => recordRemodelDebugEvent(remodelDetailEvent)).not.toThrow()
  })

  it('handles missing decks while creating sanitized records', () => {
    window._decks = undefined as unknown as typeof window._decks

    expect(createRemodelDebugRecord(remodelDetailEvent)).toMatchObject({
      context: {
        firstFleet: {},
        selectedSlotItem: {
          api_slotitem_id: 700,
          api_level: 6,
        },
      },
    })
  })

  it('logs and skips malformed circular captures', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    window._slotitems = undefined as unknown as typeof window._slotitems
    setRemodelDebugRecorderEnabled(true)

    recordRemodelDebugEvent(remodelDetailEvent)

    expect(getRemodelDebugRecords()).toHaveLength(0)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('caps in-memory captures to the latest 200 records', () => {
    setRemodelDebugRecorderEnabled(true)

    for (let index = 0; index < 205; index += 1) {
      recordRemodelDebugEvent({
        ...remodelDetailEvent,
        time: index,
      })
    }

    expect(getRemodelDebugRecords()).toHaveLength(200)
    expect(getRemodelDebugRecords()[0]?.time).toBe(5)
  })

  it('returns a copy of captured records', () => {
    setRemodelDebugRecorderEnabled(true)
    recordRemodelDebugEvent(remodelDetailEvent)

    const snapshot = getRemodelDebugRecords() as Array<unknown>
    snapshot.length = 0

    expect(getRemodelDebugRecords()).toHaveLength(1)
  })

  it('notifies subscribers when setting or records change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeRemodelDebugRecorder(listener)

    setRemodelDebugRecorderEnabled(true)
    recordRemodelDebugEvent(remodelDetailEvent)
    clearRemodelDebugRecords()

    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    setRemodelDebugRecorderEnabled(false)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('does not throw when localStorage writes fail', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.window = {
      ...createWindow(),
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('blocked')
        },
        removeItem: () => {
          throw new Error('blocked')
        },
      },
    } as unknown as Window & typeof globalThis

    expect(() => setRemodelDebugRecorderEnabled(true)).not.toThrow()
    expect(() => setRemodelDebugRecorderEnabled(false)).not.toThrow()
    expect(consoleError).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })

  it('exports captures as a delayed-revoked JSON blob', () => {
    vi.useFakeTimers()
    setRemodelDebugRecorderEnabled(true)
    recordRemodelDebugEvent(remodelDetailEvent)
    const click = vi.fn()
    const anchor = {
      click,
      download: '',
      href: '',
    }
    const createElement = vi.fn(() => anchor as unknown as HTMLElement)
    const originalDocument = globalThis.document
    globalThis.document = {
      createElement,
    } as unknown as Document
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:debug')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    exportRemodelDebugRecords()

    expect(createElement).toHaveBeenCalledWith('a')
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchor.href).toBe('blob:debug')
    expect(anchor.download).toMatch(/^plugin-report-remodel-debug-/)
    expect(click).toHaveBeenCalled()
    expect(revokeObjectUrl).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:debug')

    globalThis.document = originalDocument
    createObjectUrl.mockRestore()
    revokeObjectUrl.mockRestore()
    vi.useRealTimers()
  })
})
