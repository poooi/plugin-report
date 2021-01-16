import url from 'url'
import * as Sentry from '@sentry/electron'
import request from 'request'
import fetch from 'node-fetch'

const packageMeta = require('../package.json')
const { SERVER_HOSTNAME, POI_VERSION } = window

export default class BaseReporter {
  constructor() {
    this.SERVER_HOSTNAME = SERVER_HOSTNAME
    this.USERAGENT = `Reporter/${packageMeta.version} poi/${POI_VERSION}`
  }
  get = (...args) => request.get(...args)

  report = async (path, info) => {
    try {
      await fetch(url.resolve(`http://${this.SERVER_HOSTNAME}`, path), {
        method: 'POST',
        headers: {
          'User-Agent': this.USERAGENT,
          'X-Reporter': this.USERAGENT,
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
        body: JSON.stringify({ data: info }),
      })
    } catch (err) {
      Sentry.captureException(err, {
        area: 'poi-plugin-report',
        path,
      })
      console.error(err.stack)
    }
  }
}
