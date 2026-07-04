import * as Sentry from '@sentry/electron'
import semver from 'semver'

import { init } from './sentry'
import type { GameResponseEvent } from './types/game-api'
import type { Reporter } from './types/reporter'
import { recordRemodelDebugEvent, startRemodelDebugRecorder } from './remodel-debug-recorder'

import * as remote from '@electron/remote'

interface GameAPIBroadcaster {
  serverInfo: {
    num: number
  }
}

const gameAPIBroadcaster = remote.require<GameAPIBroadcaster>('./lib/game-api-broadcaster')

if (
  process.env.NODE_ENV === 'production' &&
  semver.lte(window.POI_VERSION, '10.6.0') &&
  config.get('poi.misc.exceptionReporting')
) {
  init({
    build: window.LATEST_COMMIT,
    paths: [window.ROOT, window.APPDATA_PATH],
  })
}

import {
  QuestReporter,
  CreateShipReporter,
  CreateItemReporter,
  DropShipReporter,
  NightContactReportor,
  RemodelRecipeReporter,
  AACIReporter,
  NightBattleCIReporter,
  ShipStatReporter,
} from './reporters'

let reporters: Reporter[] = []
let stopRemodelDebugRecorder: (() => void) | undefined
const handleResponse = (e: GameResponseEvent) => {
  if (!(gameAPIBroadcaster.serverInfo.num >= 1)) {
    return
  }
  const { method, path, body, postBody, time = Date.now() } = e.detail
  recordRemodelDebugEvent({ method, path, body, postBody, time })
  for (const reporter of reporters) {
    try {
      reporter.handle(method, path, body, postBody, time)
    } catch (err) {
      Sentry.captureException(err, {
        area: 'poi-plugin-report',
        path,
      })
      console.error(err instanceof Error ? err.stack : err)
    }
  }
}

export const show = false
export const pluginDidLoad = (_e: unknown) => {
  stopRemodelDebugRecorder = startRemodelDebugRecorder()
  reporters = [
    new QuestReporter(),
    new CreateShipReporter(),
    new CreateItemReporter(),
    new DropShipReporter(),
    new NightContactReportor(),
    new RemodelRecipeReporter(),
    new AACIReporter(),
    new NightBattleCIReporter(),
    new ShipStatReporter(),
  ]
  window.addEventListener('game.response', handleResponse)
}
export const pluginWillUnload = (_e: unknown) => {
  window.removeEventListener('game.response', handleResponse)
  stopRemodelDebugRecorder?.()
  stopRemodelDebugRecorder = undefined
}
