import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BaseReporter,
  fetchState,
  resetReporterTestState,
  sentryState,
} from '../helpers/reporter-test-harness.mjs'

beforeEach(resetReporterTestState)

describe('BaseReporter', () => {
  it('gets JSON with reporter headers and returns parsed data', async () => {
    fetchState.implementation = async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    })
    const reporter = new BaseReporter()

    await expect(reporter.getJson('/api/test')).resolves.toEqual({ ok: true })

    expect(fetchState.calls[0][0]).toBe('https://example.invalid/api/test')
    expect(fetchState.calls[0][1]).toMatchObject({
      'User-Agent': 'Reporter/8.1.0 poi/10.7.0',
      'X-Reporter': 'Reporter/8.1.0 poi/10.7.0',
      redirect: 'follow',
    })
  })

  it('captures getJson failures and returns an empty object', async () => {
    const error = new Error('network failed')
    fetchState.implementation = async () => {
      throw error
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reporter = new BaseReporter()

    await expect(reporter.getJson('/api/fail')).resolves.toEqual({})

    expect(sentryState.tags).toContainEqual({
      area: 'poi-plugin-report/getJson',
      path: '/api/fail',
    })
    expect(sentryState.contexts).toContainEqual({
      name: 'versions',
      context: { reporter: '8.1.0', poi: '10.7.0' },
    })
    expect(sentryState.captured).toEqual([error])
    consoleError.mockRestore()
  })

  it('posts report payloads with JSON headers', async () => {
    fetchState.implementation = async () => ({
      ok: true,
      text: async () => '',
    })
    const reporter = new BaseReporter()

    await reporter.report('/api/report/test', { value: 1 })

    expect(fetchState.calls[0][0]).toBe('https://example.invalid/api/report/test')
    expect(fetchState.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        'User-Agent': 'Reporter/8.1.0 poi/10.7.0',
        'X-Reporter': 'Reporter/8.1.0 poi/10.7.0',
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
      body: JSON.stringify({ data: { value: 1 } }),
    })
  })

  it('captures non-OK report responses with response text and payload context', async () => {
    fetchState.implementation = async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'bad',
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reporter = new BaseReporter()

    await reporter.report('/api/report/fail', { value: 1 })

    expect(sentryState.tags).toContainEqual({
      area: 'poi-plugin-report/report',
      path: '/api/report/fail',
    })
    expect(sentryState.contexts).toContainEqual({
      name: 'data',
      context: { value: 1 },
    })
    expect(sentryState.captured[0]).toMatchObject({
      message: 'report failed 500 Server Error: bad',
    })
    consoleError.mockRestore()
  })
})
