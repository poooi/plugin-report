import * as Sentry from '@sentry/electron'
import semver from 'semver'

import { init } from './sentry'

import * as remote from '@electron/remote'

const gameAPIBroadcaster = remote.require('./lib/game-api-broadcaster')

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

let reporters = []
const handleResponse = e => {
  if (!(gameAPIBroadcaster.serverInfo.num >= 1)) {
    return
  }
  const { method, path, body, postBody, time = Date.now() } = e.detail
  for (const reporter of reporters) {
    try {
      reporter.handle(method, path, body, postBody, time)
    } catch (err) {
      Sentry.captureException(err, {
        area: 'poi-plugin-report',
        path,
      })
      console.error(err.stack)
    }
  }
}

export const show = false
export const pluginDidLoad = e => {
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
export const pluginWillUnload = e => {
  window.removeEventListener('game.response', handleResponse)
}
