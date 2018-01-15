import Promise from 'bluebird'
import request from 'request'
import url from 'url'

Promise.promisifyAll(request)
const packageMeta = require('../package.json')
const { SERVER_HOSTNAME } = window

export default class BaseReporter {
  constructor() {
    this.SERVER_HOSTNAME = SERVER_HOSTNAME
    this.USERAGENT = `Reporter v${packageMeta.version}`
  }
  get = (...args) => request.get(...args)
  postAsync = (...args) => request.postAsync(...args)

  report = async (path, info) => {
    // console.log(path, info)
    try {
      await this.postAsync(
        url.resolve(`http://${this.SERVER_HOSTNAME}`, path),
        {
          headers: {
            'User-Agent': this.USERAGENT,
          },
          form: {
            data: JSON.stringify(info),
          },
        }
      )
    }
    catch (err) {
      console.error(err.stack)
    }
  }
}
