import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import Module from 'node:module'
import { vi } from 'vitest'

const require = createRequire(import.meta.url)
const originalLoad = Module._load

export const selectorState = {
  store: {},
  ships: new Map(),
  equips: new Map(),
}

export const aaciState = {
  getShipAACIs: vi.fn(() => []),
}

export const momentState = {
  hour: 16,
  day: 2,
}

export const fetchState = {
  calls: [],
  implementation: async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    text: async () => '',
  }),
}

export const sentryState = {
  captured: [],
  contexts: [],
  tags: [],
}

export const ship = overrides => ({
  api_ship_id: 100,
  api_lv: 50,
  api_cond: 49,
  api_slot: [],
  api_onslot: [],
  ...overrides,
})

export const equip = ({ id = 0, type2 = 0, type3 = 0, level = 0, houm = 0 } = {}) => ({
  api_slotitem_id: id,
  api_type: [0, 0, type2, type3],
  api_level: level,
  api_houm: houm,
})

const createWindow = () => ({
  POI_VERSION: '10.7.0',
  SERVER_HOSTNAME: 'example.invalid',
  _decks: [{ api_ship: [1, 2] }],
  _ships: {
    1: ship({ api_ship_id: 101, api_lv: 80, api_cond: 53 }),
    2: ship({ api_ship_id: 102, api_lv: 70, api_cond: 49 }),
  },
  $ships: {
    101: { api_id: 101, api_yomi: 'alpha' },
    102: { api_id: 102, api_yomi: 'bravo' },
  },
  _slotitems: {},
  _teitokuId: 12345,
  _teitokuLv: 120,
  _nickName: 'Admiral',
  _nickNameId: 99,
  getStore: () => selectorState.store,
})

globalThis.window = createWindow()

const sentryStub = {
  captureException(error) {
    sentryState.captured.push(error)
  },
  setContext(name, context) {
    sentryState.contexts.push({ name, context })
  },
  withScope(callback) {
    callback({
      setTags(tags) {
        sentryState.tags.push(tags)
      },
    })
  },
}

if (!globalThis.__reporterTestHarnessPatched) {
  Module._load = function loadReporterTestStub(request, parent, isMain) {
    switch (request) {
      case '@sentry/electron':
        return sentryStub
      case 'node-fetch':
        return async (...args) => {
          fetchState.calls.push(args)
          return fetchState.implementation(...args)
        }
      case 'moment-timezone':
        return {
          utc: () => ({
            hour: () => momentState.hour,
            day: () => momentState.day,
          }),
        }
      case 'views/utils/selectors':
        return {
          shipDataSelectorFactory: shipId => () => selectorState.ships.get(shipId),
          shipEquipDataSelectorFactory: shipId => () => selectorState.equips.get(shipId),
        }
      case 'views/utils/aaci':
        return aaciState
      default:
        return originalLoad.call(this, request, parent, isMain)
    }
  }
  globalThis.__reporterTestHarnessPatched = true
}

const loadDefault = mod => mod.default || mod

export const AACIReporter = loadDefault(require('../../reporters/aaci.js'))
export const BaseReporter = loadDefault(require('../../reporters/base.js'))
export const CreateItemReporter = loadDefault(require('../../reporters/create-item.js'))
export const CreateShipReporter = loadDefault(require('../../reporters/create-ship.js'))
export const DropShipReporter = loadDefault(require('../../reporters/drop-ship.js'))
export const NightBattleCIReporter = loadDefault(require('../../reporters/night-battle-ci.js'))
export const NightContactReportor = loadDefault(require('../../reporters/night-contact.js'))
export const QuestReporter = loadDefault(require('../../reporters/quest.js'))
export const RemodelItemReporter = loadDefault(require('../../reporters/remodel-item.js'))
export const RemodelRecipeReporter = loadDefault(require('../../reporters/remodel-recipe.js'))
export const ShipStatReporter = loadDefault(require('../../reporters/ship-stat.js'))

export const resetReporterTestState = () => {
  globalThis.window = createWindow()
  selectorState.store = {
    sortie: { sortieMapId: 1 },
    battle: { _status: { result: { deckHp: [] } } },
    const: { $ships: {} },
  }
  selectorState.ships.clear()
  selectorState.equips.clear()
  aaciState.getShipAACIs = vi.fn(() => [])
  momentState.hour = 16
  momentState.day = 2
  fetchState.calls = []
  fetchState.implementation = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    text: async () => '',
  })
  sentryState.captured = []
  sentryState.contexts = []
  sentryState.tags = []
}

export const attachReportSpy = reporter => {
  reporter.report = vi.fn(() => Promise.resolve())
  return reporter.report
}

export const teitokuHash = () =>
  createHash('sha1')
    .update(`${window._teitokuId}_${window._nickName}_${window._nickNameId}`)
    .digest('base64')
