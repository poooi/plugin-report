import * as Sentry from '@sentry/electron'

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
