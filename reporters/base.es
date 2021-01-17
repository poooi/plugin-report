import url from 'url'
import * as Sentry from '@sentry/electron'
import fetch from 'node-fetch'

const packageMeta = require('../package.json')
const { SERVER_HOSTNAME, POI_VERSION } = window

export default class BaseReporter {
  constructor() {
    this.SERVER_HOSTNAME = SERVER_HOSTNAME
    this.USERAGENT = `Reporter/${packageMeta.version} poi/${POI_VERSION}`
  }

  getJson = async path => {
    try {
      const resp = await fetch(url.resolve(`http://${this.SERVER_HOSTNAME}`, path), {
        'User-Agent': this.USERAGENT,
        'X-Reporter': this.USERAGENT,
        redirect: 'follow',
      })
      const result = await resp.json()
      return result
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setTags({
          area: 'poi-plugin-report/getJson',
          path,
        })
        Sentry.setContext('versions', {
          reporter: packageMeta.version,
          poi: POI_VERSION,
        })
        Sentry.captureException(err)
      })

      return {}
    }
  }

  report = async (path, info) => {
    try {
      const resp = await fetch(url.resolve(`https://${this.SERVER_HOSTNAME}`, path), {
        method: 'POST',
        headers: {
          'User-Agent': this.USERAGENT,
          'X-Reporter': this.USERAGENT,
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
        body: JSON.stringify({ data: info }),
      })

      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`report failed ${resp.status} ${resp.statusText}: ${text}`)
      }
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setTags({
          area: 'poi-plugin-report/report',
          path,
        })
        Sentry.setContext('versions', {
          reporter: packageMeta.version,
          poi: POI_VERSION,
        })
        Sentry.setContext('data', info)
        Sentry.captureException(err)
      })
      console.error(err.stack)
    }
  }
}
