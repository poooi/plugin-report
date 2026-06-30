const assert = require('assert')
const fs = require('fs')
const Module = require('module')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const entryPath = path.join(projectRoot, 'index.js')
const baseReporterPath = path.join(projectRoot, 'reporters', 'base.js')

if (!fs.existsSync(entryPath)) {
  console.log('[smoke-load] index.js not found; skipping until built output exists.')
  process.exit(0)
}

const packageMeta = require(path.join(projectRoot, 'package.json'))
const listeners = new Map()
const fetchCalls = []
const startupFetchCalls = []

global.window = {
  POI_VERSION: '10.7.0',
  LATEST_COMMIT: 'smoke-test',
  ROOT: projectRoot,
  APPDATA_PATH: path.join(projectRoot, '.poi-smoke'),
  SERVER_HOSTNAME: 'example.invalid',
  _decks: [{ api_ship: [1, 2, 3, 4, 5, 6] }],
  _ships: {},
  $ships: {},
  _slotitems: {},
  _teitokuId: 1,
  _teitokuLv: 1,
  _nickName: 'smoke',
  _nickNameId: 1,
  getStore() {
    return {
      sortie: { sortieMapId: 1 },
      battle: { _status: { result: { deckHp: [] } } },
      const: { $ships: {} },
    }
  },
  addEventListener(name, listener) {
    listeners.set(name, listener)
  },
  removeEventListener(name, listener) {
    assert.strictEqual(listeners.get(name), listener)
    listeners.delete(name)
  },
}

global.config = {
  get() {
    return false
  },
}

const gameAPIBroadcaster = {
  serverInfo: { num: 1 },
}

const sentryScope = {
  setContext() {},
  setTag() {},
  setTags() {},
}

const sentryStub = {
  captureException() {},
  configureScope(callback) {
    callback(sentryScope)
  },
  init() {},
  setContext() {},
  withScope(callback) {
    callback(sentryScope)
  },
}

const lodashImplementations = {
  compact(values) {
    return values.filter(Boolean)
  },
  each(collection, iteratee) {
    for (const item of Object.values(collection || {})) {
      if (iteratee(item) === false) {
        break
      }
    }
    return collection
  },
  filter(values, iteratee) {
    return values.filter(iteratee)
  },
  find(values, iteratee) {
    return values.find(iteratee)
  },
  get(value, keyPath, defaultValue) {
    const keys = Array.isArray(keyPath) ? keyPath : String(keyPath).split('.')
    let current = value
    for (const key of keys) {
      current = current?.[key]
      if (current === undefined) {
        return defaultValue
      }
    }
    return current
  },
  includes(value, search) {
    return value?.includes?.(search) || false
  },
  isArray: Array.isArray,
  isString(value) {
    return typeof value === 'string'
  },
  keyBy(values, key) {
    return Object.fromEntries((values || []).map(value => [value[key], value]))
  },
  map(values, iteratee) {
    return values.map(iteratee)
  },
  memoize(fn) {
    const cache = new Map()
    return value => {
      if (!cache.has(value)) {
        cache.set(value, fn(value))
      }
      return cache.get(value)
    }
  },
  range(start, end) {
    return Array.from({ length: end - start }, (_, index) => start + index)
  },
  some(values, iteratee) {
    return values.some(iteratee)
  },
  split(value, separator) {
    return String(value).split(separator)
  },
  sum(values) {
    return values.reduce((total, value) => total + value, 0)
  },
  takeRight(values, count) {
    return values.slice(-count)
  },
  zip(...arrays) {
    const length = Math.max(...arrays.map(array => array.length))
    return Array.from({ length }, (_, index) => arrays.map(array => array[index]))
  },
}

const lodashStub = new Proxy(lodashImplementations, {
  get(target, property) {
    if (property in target) {
      return target[property]
    }
    if (property === '__esModule') {
      return false
    }
    return () => {
      throw new Error(`Missing lodash smoke stub: ${String(property)}`)
    }
  },
})

const fetchStub = async (requestUrl, options = {}) => {
  const calls = requestUrl.endsWith('/api/report/v3/known_quests')
    ? startupFetchCalls
    : fetchCalls
  calls.push({ requestUrl, options })
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ ok: true }),
    text: async () => '',
  }
}

const selectorStubs = {
  shipDataSelectorFactory() {
    return () => [{}, {}]
  },
  shipEquipDataSelectorFactory() {
    return () => []
  },
}

const momentStub = () => ({
  format: () => '1970-01-01',
  tz: () => momentStub(),
})
momentStub.tz = () => momentStub()

const originalLoad = Module._load

Module._load = function smokeLoad(request, parent, isMain) {
  switch (request) {
    case '@electron/remote':
      return {
        require(moduleId) {
          assert.strictEqual(moduleId, './lib/game-api-broadcaster')
          return gameAPIBroadcaster
        },
      }
    case '@sentry/electron':
      return sentryStub
    case 'node-fetch':
      return fetchStub
    case 'lodash':
      return lodashStub
    case 'moment-timezone':
      return momentStub
    case 'semver':
      return {
        lte: () => false,
      }
    case 'views/utils/selectors':
      return selectorStubs
    case 'views/utils/aaci':
      return {
        getShipAACIs: () => [],
      }
    default:
      return originalLoad.call(this, request, parent, isMain)
  }
}

const loadExport = mod => mod && (mod.default || mod)

async function main() {
  try {
    const plugin = require(entryPath)

    assert.strictEqual(plugin.show, false)
    assert.strictEqual(typeof plugin.pluginDidLoad, 'function')
    assert.strictEqual(typeof plugin.pluginWillUnload, 'function')

    plugin.pluginDidLoad({})
    assert.strictEqual(typeof listeners.get('game.response'), 'function')

    plugin.pluginWillUnload({})
    assert.strictEqual(listeners.has('game.response'), false)

    await Promise.resolve()
    assert.strictEqual(startupFetchCalls.length, 1)
    assert.strictEqual(startupFetchCalls[0].requestUrl, 'https://example.invalid/api/report/v3/known_quests')

    const BaseReporter = loadExport(require(baseReporterPath))
    const reporter = new BaseReporter()
    assert.strictEqual(reporter.SERVER_HOSTNAME, 'example.invalid')
    assert.strictEqual(reporter.USERAGENT, `Reporter/${packageMeta.version} poi/10.7.0`)

    const json = await reporter.getJson('/api/smoke')
    assert.deepStrictEqual(json, { ok: true })
    assert.strictEqual(fetchCalls[0].requestUrl, 'https://example.invalid/api/smoke')

    await reporter.report('/api/report/smoke', { ok: true })
    assert.strictEqual(fetchCalls[1].requestUrl, 'https://example.invalid/api/report/smoke')
    assert.strictEqual(fetchCalls[1].options.method, 'POST')
    assert.deepStrictEqual(JSON.parse(fetchCalls[1].options.body), { data: { ok: true } })

    console.log('[smoke-load] built plugin loaded and reporter base exercised.')
  } finally {
    Module._load = originalLoad
  }
}

main().catch(error => {
  Module._load = originalLoad
  console.error(error)
  process.exitCode = 1
})
