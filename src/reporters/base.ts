import url from 'url'
import * as Sentry from '@sentry/electron'
import fetch, { type RequestInit } from 'node-fetch'
import https from 'https'
import type { ReportPayload } from '../types/reporter'

// Because let's encrypt has switched to a new root cert which is not supported in older version of Electron,
// use this temporary way to disable SSL check
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
})

const getReporterVersion = (): string => {
  const globalReporterVersion = (globalThis as { __REPORTER_VERSION__?: string })
    .__REPORTER_VERSION__
  return typeof __REPORTER_VERSION__ === 'string'
    ? __REPORTER_VERSION__
    : (globalReporterVersion ?? '0.0.0-dev')
}

export default class BaseReporter {
  SERVER_HOSTNAME: string
  USERAGENT: string
  POI_VERSION: string
  REPORTER_VERSION: string

  constructor() {
    const { SERVER_HOSTNAME, POI_VERSION } = globalThis.window
    this.SERVER_HOSTNAME = SERVER_HOSTNAME
    this.POI_VERSION = POI_VERSION
    this.REPORTER_VERSION = getReporterVersion()
    this.USERAGENT = `Reporter/${this.REPORTER_VERSION} poi/${this.POI_VERSION}`
  }

  getJson = async <T = unknown>(path: string): Promise<T | Record<string, never>> => {
    try {
      const requestOptions: RequestInit = {
        headers: {
          'User-Agent': this.USERAGENT,
          'X-Reporter': this.USERAGENT,
        },
        redirect: 'follow',
        agent: insecureAgent,
      }
      const resp = await fetch(url.resolve(`https://${this.SERVER_HOSTNAME}`, path), requestOptions)
      const result = (await resp.json()) as T
      return result
    } catch (err) {
      Sentry.withScope((scope) => {
        scope.setTags({
          area: 'poi-plugin-report/getJson',
          path,
        })
        Sentry.setContext('versions', {
          reporter: this.REPORTER_VERSION,
          poi: this.POI_VERSION,
        })
        Sentry.captureException(err)
      })
      console.error(err)

      return {}
    }
  }

  report = async (path: string, info: ReportPayload): Promise<void> => {
    try {
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'User-Agent': this.USERAGENT,
          'X-Reporter': this.USERAGENT,
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
        body: JSON.stringify({ data: info }),
        agent: insecureAgent,
      }
      const resp = await fetch(url.resolve(`https://${this.SERVER_HOSTNAME}`, path), requestOptions)

      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`report failed ${resp.status} ${resp.statusText}: ${text}`)
      }
    } catch (err) {
      Sentry.withScope((scope) => {
        scope.setTags({
          area: 'poi-plugin-report/report',
          path,
        })
        Sentry.setContext('versions', {
          reporter: this.REPORTER_VERSION,
          poi: this.POI_VERSION,
        })
        Sentry.setContext('data', info)
        Sentry.captureException(err)
      })
      console.error(err)
    }
  }
}
