import { createHash } from 'node:crypto'
import Module from 'node:module'
import { vi } from 'vitest'
import packageMeta from '../../package.json'
import type { PoiWindowStoreState, WindowShip, WindowSlotItem } from '../../src/types/window-state'
import SourceAACIReporter from '../../src/reporters/aaci'
import SourceBaseReporter from '../../src/reporters/base'
import SourceCreateItemReporter from '../../src/reporters/create-item'
import SourceCreateShipReporter from '../../src/reporters/create-ship'
import SourceDropShipReporter from '../../src/reporters/drop-ship'
import SourceNightBattleCIReporter from '../../src/reporters/night-battle-ci'
import SourceNightContactReportor from '../../src/reporters/night-contact'
import SourceQuestReporter from '../../src/reporters/quest'
import SourceRemodelItemReporter from '../../src/reporters/remodel-item'
import SourceRemodelRecipeReporter from '../../src/reporters/remodel-recipe'
import SourceShipStatReporter from '../../src/reporters/ship-stat'
import type { Reporter } from '../../src/types/reporter'

type TestWindowShip = WindowShip & Record<string, unknown>
type GetShipAACIs = (ship: { api_ship_id?: number }, equips?: unknown) => number[]
type TestStore = Record<string, unknown> & {
  battle: { _status: { result: { deckHp: number[] } } }
  const: { $ships: Record<number, Record<string, unknown>> }
  sortie: { sortieMapId: number }
}
type ReporterHandleArgs = Parameters<Reporter['handle']>
type ReporterUnderTest = SourceBaseReporter &
  Record<string, unknown> & {
    handle(
      method: ReporterHandleArgs[0],
      path: ReporterHandleArgs[1],
      body: ReporterHandleArgs[2],
      postBody?: ReporterHandleArgs[3],
      time?: ReporterHandleArgs[4],
    ): ReturnType<Reporter['handle']>
    processData: (...args: unknown[]) => unknown
  }
type ReporterUnderTestConstructor = new () => ReporterUnderTest
type FetchResponseStub = {
  ok?: boolean
  status?: number
  statusText?: string
  json?: () => Promise<unknown>
  text?: () => Promise<string>
}

const asReporterUnderTest = <T extends new () => SourceBaseReporter>(
  Reporter: T,
): ReporterUnderTestConstructor => Reporter as unknown as ReporterUnderTestConstructor

const state = vi.hoisted(() => {
  const defaultStore = (): TestStore => ({
    sortie: { sortieMapId: 1 },
    battle: { _status: { result: { deckHp: [] } } },
    const: { $ships: {} },
  })

  const ship = (overrides: Record<string, unknown> = {}) =>
    ({
      api_ship_id: 100,
      api_lv: 50,
      api_cond: 49,
      api_slot: [],
      api_onslot: [],
      ...overrides,
    }) as TestWindowShip

  const selectorState = {
    store: defaultStore(),
    ships: new Map<number, unknown>(),
    equips: new Map<number, unknown>(),
  }

  const aaciState: { getShipAACIs: GetShipAACIs } = {
    getShipAACIs: vi.fn(() => [] as number[]),
  }

  const momentState = {
    hour: 16,
    day: 2,
  }

  const fetchState = {
    calls: [] as unknown[][],
    implementation: async (..._args: unknown[]): Promise<FetchResponseStub> => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => '',
    }),
  }

  const sentryState = {
    captured: [] as unknown[],
    contexts: [] as Array<{ name: string; context: unknown }>,
    tags: [] as unknown[],
  }

  const createWindow = () =>
    ({
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
      getStore: () => selectorState.store as PoiWindowStoreState,
    }) as unknown as Window & typeof globalThis

  globalThis.window = createWindow()
  ;(globalThis as { __reporterTestHarnessState?: unknown }).__reporterTestHarnessState = {
    aaciState,
    selectorState,
  }

  return {
    aaciState,
    createWindow,
    fetchState,
    momentState,
    selectorState,
    sentryState,
  }
})

export const { aaciState, fetchState, momentState, selectorState, sentryState } = state

;(globalThis as unknown as { __REPORTER_VERSION__: string }).__REPORTER_VERSION__ =
  packageMeta.version

declare global {
  var __reporterTestHarnessPatched: boolean | undefined
}

type ModuleWithLoad = typeof Module & {
  _load(request: string, parent: NodeJS.Module | null | undefined, isMain: boolean): unknown
}

const moduleWithLoad = Module as ModuleWithLoad
const originalLoad = moduleWithLoad._load

vi.mock('@sentry/electron', () => ({
  captureException(error: unknown) {
    sentryState.captured.push(error)
  },
  setContext(name: string, context: unknown) {
    sentryState.contexts.push({ name, context })
  },
  withScope(callback: (scope: { setTags(tags: unknown): void }) => void) {
    callback({
      setTags(tags: unknown) {
        sentryState.tags.push(tags)
      },
    })
  },
}))

vi.mock('node-fetch', () => ({
  default: async (...args: unknown[]) => {
    fetchState.calls.push(args)
    return fetchState.implementation(...args)
  },
}))

vi.mock('moment-timezone', () => ({
  default: {
    utc: () => ({
      hour: () => momentState.hour,
      day: () => momentState.day,
    }),
  },
}))

vi.mock('views/utils/selectors', () => ({
  shipDataSelectorFactory: (shipId: number) => () => selectorState.ships.get(shipId),
  shipEquipDataSelectorFactory: (shipId: number) => () => selectorState.equips.get(shipId),
}))

vi.mock('views/utils/aaci', () => aaciState)

if (!globalThis.__reporterTestHarnessPatched) {
  moduleWithLoad._load = function loadReporterTestStub(
    request: string,
    parent: NodeJS.Module | null | undefined,
    isMain: boolean,
  ) {
    if (request === 'views/utils/aaci') {
      return aaciState
    }

    return originalLoad.call(this, request, parent, isMain)
  }
  globalThis.__reporterTestHarnessPatched = true
}

export const ship = (overrides: Record<string, unknown> = {}) =>
  ({
    api_ship_id: 100,
    api_lv: 50,
    api_cond: 49,
    api_slot: [],
    api_onslot: [],
    ...overrides,
  }) as TestWindowShip

export const equip = ({
  id = 0,
  type2 = 0,
  type3 = 0,
  level = 0,
  houm = 0,
} = {}): WindowSlotItem & { api_houm: number; api_type: number[] } => ({
  api_slotitem_id: id,
  api_type: [0, 0, type2, type3],
  api_level: level,
  api_houm: houm,
})

export const AACIReporter = asReporterUnderTest(SourceAACIReporter)
export const BaseReporter = SourceBaseReporter
export const CreateItemReporter = asReporterUnderTest(SourceCreateItemReporter)
export const CreateShipReporter = asReporterUnderTest(SourceCreateShipReporter)
export const DropShipReporter = asReporterUnderTest(SourceDropShipReporter)
export const NightBattleCIReporter = asReporterUnderTest(SourceNightBattleCIReporter)
export const NightContactReportor = asReporterUnderTest(SourceNightContactReportor)
export const QuestReporter = asReporterUnderTest(SourceQuestReporter)
export const RemodelItemReporter = asReporterUnderTest(SourceRemodelItemReporter)
export const RemodelRecipeReporter = asReporterUnderTest(SourceRemodelRecipeReporter)
export const ShipStatReporter = asReporterUnderTest(SourceShipStatReporter)

export const resetReporterTestState = () => {
  globalThis.window = state.createWindow()
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

export const attachReportSpy = (reporter: SourceBaseReporter) => {
  const report = vi.fn<SourceBaseReporter['report']>(() => Promise.resolve())
  reporter.report = report
  return report
}

export const teitokuHash = () =>
  createHash('sha1')
    .update(`${window._teitokuId}_${window._nickName}_${window._nickNameId}`)
    .digest('base64')
