import type { GameResponseEventDetail } from './types/game-api'

const ENABLED_KEY = 'poi-plugin-report:remodel-debug-recorder'
const MAX_RECORDS = 200

const REMODEL_PATHS = new Set([
  '/kcsapi/api_req_kousyou/remodel_slotlist',
  '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
  '/kcsapi/api_req_kousyou/remodel_slot',
])

interface SanitizedFleetContext {
  firstFleet?: {
    flagship?: {
      api_ship_id?: number
    }
    secondShip?: {
      api_ship_id?: number
    }
  }
  selectedSlotItem?: {
    api_slotitem_id?: number
    api_level?: number
  }
}

export interface RemodelDebugRecord {
  time: number
  method: string
  path: string
  postBody: unknown
  body: unknown
  context: SanitizedFleetContext
}

const records: RemodelDebugRecord[] = []
const listeners = new Set<() => void>()

const notifyListeners = (): void => {
  for (const listener of listeners) {
    listener()
  }
}

const cloneJson = (value: unknown): unknown => {
  if (value == null) {
    return value
  }
  return JSON.parse(JSON.stringify(value)) as unknown
}

export const isRemodelDebugRecorderEnabled = (): boolean => {
  try {
    return window.localStorage?.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export const setRemodelDebugRecorderEnabled = (enabled: boolean): void => {
  try {
    if (enabled) {
      window.localStorage?.setItem(ENABLED_KEY, '1')
    } else {
      window.localStorage?.removeItem(ENABLED_KEY)
    }
  } catch (err) {
    console.error(err)
  }
  notifyListeners()
}

export const subscribeRemodelDebugRecorder = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getPostBodySlotId = (postBody: unknown): string | number | undefined => {
  if (postBody == null || typeof postBody !== 'object') {
    return undefined
  }
  const slotId = (postBody as Record<string, unknown>).api_slot_id
  return typeof slotId === 'string' || typeof slotId === 'number' ? slotId : undefined
}

const pickNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key]
  return typeof value === 'number' ? value : undefined
}

const pickStringOrNumber = (
  record: Record<string, unknown>,
  key: string,
): string | number | undefined => {
  const value = record[key]
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

const pickBooleanOrNumber = (
  record: Record<string, unknown>,
  key: string,
): boolean | number | undefined => {
  const value = record[key]
  return typeof value === 'boolean' || typeof value === 'number' ? value : undefined
}

const sanitizePostBody = (path: string, postBody: unknown): unknown => {
  if (postBody == null || typeof postBody !== 'object') {
    return {}
  }
  const record = postBody as Record<string, unknown>

  switch (path) {
    case '/kcsapi/api_req_kousyou/remodel_slotlist_detail':
      return {
        api_id: pickStringOrNumber(record, 'api_id'),
      }
    case '/kcsapi/api_req_kousyou/remodel_slot':
      return {
        api_id: pickStringOrNumber(record, 'api_id'),
        api_certain_flag: pickStringOrNumber(record, 'api_certain_flag'),
      }
    default:
      return {}
  }
}

const sanitizeListBody = (body: unknown): unknown => {
  if (!Array.isArray(body)) {
    return []
  }

  return body.map((entry: unknown) => {
    const record =
      entry != null && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
    return {
      api_id: pickNumber(record, 'api_id'),
      api_slot_id: pickNumber(record, 'api_slot_id'),
      api_req_fuel: pickNumber(record, 'api_req_fuel'),
      api_req_bull: pickNumber(record, 'api_req_bull'),
      api_req_steel: pickNumber(record, 'api_req_steel'),
      api_req_bauxite: pickNumber(record, 'api_req_bauxite'),
    }
  })
}

const sanitizeDetailBody = (body: unknown): unknown => {
  const record = body != null && typeof body === 'object' ? (body as Record<string, unknown>) : {}

  return {
    api_req_buildkit: pickNumber(record, 'api_req_buildkit'),
    api_req_remodelkit: pickNumber(record, 'api_req_remodelkit'),
    api_certain_buildkit: pickNumber(record, 'api_certain_buildkit'),
    api_certain_remodelkit: pickNumber(record, 'api_certain_remodelkit'),
    api_req_slot_id: pickNumber(record, 'api_req_slot_id'),
    api_req_slot_num: pickNumber(record, 'api_req_slot_num'),
    api_req_slot_id2: pickNumber(record, 'api_req_slot_id2'),
    api_req_slot_num2: pickNumber(record, 'api_req_slot_num2'),
    api_req_useitem_id: pickNumber(record, 'api_req_useitem_id'),
    api_req_useitem_num: pickNumber(record, 'api_req_useitem_num'),
    api_req_useitem_id2: pickNumber(record, 'api_req_useitem_id2'),
    api_req_useitem_num2: pickNumber(record, 'api_req_useitem_num2'),
    api_change_flag: pickNumber(record, 'api_change_flag'),
  }
}

const sanitizeSlotBody = (body: unknown): unknown => {
  const record = body != null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const afterSlot =
    record.api_after_slot != null && typeof record.api_after_slot === 'object'
      ? (record.api_after_slot as Record<string, unknown>)
      : {}

  return {
    api_remodel_flag: pickBooleanOrNumber(record, 'api_remodel_flag'),
    api_remodel_id: Array.isArray(record.api_remodel_id)
      ? record.api_remodel_id.filter((value) => typeof value === 'number')
      : undefined,
    api_after_slot: {
      api_slotitem_id: pickNumber(afterSlot, 'api_slotitem_id'),
      api_level: pickNumber(afterSlot, 'api_level'),
      api_alv: pickNumber(afterSlot, 'api_alv'),
    },
    api_voice_ship_id: pickNumber(record, 'api_voice_ship_id'),
  }
}

const sanitizeBody = (path: string, body: unknown): unknown => {
  switch (path) {
    case '/kcsapi/api_req_kousyou/remodel_slotlist':
      return sanitizeListBody(body)
    case '/kcsapi/api_req_kousyou/remodel_slotlist_detail':
      return sanitizeDetailBody(body)
    case '/kcsapi/api_req_kousyou/remodel_slot':
      return sanitizeSlotBody(body)
    default:
      return {}
  }
}

const createSanitizedContext = (slotId: string | number | undefined): SanitizedFleetContext => {
  const deckShipIds = window._decks[0]?.api_ship?.slice(0, 2) || []
  const flagship = deckShipIds[0] == null ? undefined : window._ships[deckShipIds[0]]
  const secondShip = deckShipIds[1] == null ? undefined : window._ships[deckShipIds[1]]
  if (slotId != null) {
    const slotitem = window._slotitems[slotId]
    if (slotitem) {
      return {
        firstFleet: {
          flagship: flagship ? { api_ship_id: flagship.api_ship_id } : undefined,
          secondShip: secondShip ? { api_ship_id: secondShip.api_ship_id } : undefined,
        },
        selectedSlotItem: {
          api_slotitem_id: slotitem.api_slotitem_id,
          api_level: slotitem.api_level,
        },
      }
    }
  }

  return {
    firstFleet: {
      flagship: flagship ? { api_ship_id: flagship.api_ship_id } : undefined,
      secondShip: secondShip ? { api_ship_id: secondShip.api_ship_id } : undefined,
    },
  }
}

const stripUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined)
  }
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)]),
    )
  }
  return value
}

const createSanitizedRecordBody = (path: string, body: unknown): unknown =>
  stripUndefined(sanitizeBody(path, body))

const createSanitizedRecordPostBody = (path: string, postBody: unknown): unknown =>
  stripUndefined(sanitizePostBody(path, postBody))

const createSanitizedRecordContext = (slotId: string | number | undefined): SanitizedFleetContext =>
  stripUndefined(createSanitizedContext(slotId)) as SanitizedFleetContext

export const createRemodelDebugRecord = (
  event: GameResponseEventDetail,
): RemodelDebugRecord | undefined => {
  if (!REMODEL_PATHS.has(event.path)) {
    return undefined
  }

  return {
    time: event.time,
    method: event.method,
    path: event.path,
    postBody: cloneJson(createSanitizedRecordPostBody(event.path, event.postBody)),
    body: cloneJson(createSanitizedRecordBody(event.path, event.body)),
    context: createSanitizedRecordContext(getPostBodySlotId(event.postBody)),
  }
}

export const recordRemodelDebugEvent = (event: GameResponseEventDetail): void => {
  if (!isRemodelDebugRecorderEnabled()) {
    return
  }

  try {
    const record = createRemodelDebugRecord(event)
    if (!record) {
      return
    }

    records.push(record)
    if (records.length > MAX_RECORDS) {
      records.splice(0, records.length - MAX_RECORDS)
    }
    notifyListeners()
  } catch (err) {
    console.error(err)
  }
}

export const clearRemodelDebugRecords = (): void => {
  records.length = 0
  notifyListeners()
}

export const getRemodelDebugRecords = (): readonly RemodelDebugRecord[] => records

export const exportRemodelDebugRecords = (): void => {
  const blob = new Blob([JSON.stringify({ records }, null, 2)], {
    type: 'application/json',
  })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `plugin-report-remodel-debug-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(href), 0)
}
