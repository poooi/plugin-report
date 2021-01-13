import Promise from 'bluebird'
import request from 'request'
import url from 'url'
import * as Sentry from '@sentry/electron'

Promise.promisifyAll(request)
const packageMeta = require('../package.json')
const { SERVER_HOSTNAME, POI_VERSION } = window

export default class BaseReporter {
  constructor() {
    this.SERVER_HOSTNAME = SERVER_HOSTNAME
    this.USERAGENT = `Reporter/${packageMeta.version} poi/${POI_VERSION}`
  }
  get = (...args) => request.get(...args)
  postAsync = (...args) => request.postAsync(...args)

  report = async (path, info) => {
    // console.log(path, info)
    try {
      await this.postAsync(url.resolve(`https://${this.SERVER_HOSTNAME}`, path), {
        headers: {
          'User-Agent': this.USERAGENT,
        },
        form: {
          data: JSON.stringify(info),
        },
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
