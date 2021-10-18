import url from 'url'
import * as Sentry from '@sentry/electron'
import fetch from 'node-fetch'
import https from 'https'

// Because let's encrypt has switched to a new root cert which is not supported in older version of Electron,
// use this temporary way to disable SSL check
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
})

const packageMeta = require('../package.json')
const { SERVER_HOSTNAME, POI_VERSION } = window

export default class BaseReporter {
  constructor() {
    this.SERVER_HOSTNAME = SERVER_HOSTNAME
    this.USERAGENT = `Reporter/${packageMeta.version} poi/${POI_VERSION}`
  }

  getJson = async path => {
    try {
      const resp = await fetch(url.resolve(`https://${this.SERVER_HOSTNAME}`, path), {
        'User-Agent': this.USERAGENT,
        'X-Reporter': this.USERAGENT,
        redirect: 'follow',
        agent: insecureAgent,
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
      console.error(err)

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
        agent: insecureAgent,
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
      console.error(err)
    }
  }
}
