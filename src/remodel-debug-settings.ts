import React, { Component, type CSSProperties, type ReactNode } from 'react'
import {
  clearRemodelDebugRecords,
  exportRemodelDebugRecords,
  getRemodelDebugRecords,
  isRemodelDebugRecorderEnabled,
  setRemodelDebugRecorderEnabled,
} from './remodel-debug-recorder'

interface RemodelDebugSettingsState {
  enabled: boolean
  count: number
}

const createStyle = (style: CSSProperties): CSSProperties => style

export default class RemodelDebugSettings extends Component<
  Record<string, never>,
  RemodelDebugSettingsState
> {
  refreshTimer: ReturnType<typeof setInterval> | undefined

  constructor(props: Record<string, never>) {
    super(props)
    this.state = {
      enabled: isRemodelDebugRecorderEnabled(),
      count: getRemodelDebugRecords().length,
    }
  }

  componentDidMount() {
    this.refreshTimer = setInterval(() => {
      this.setState({
        enabled: isRemodelDebugRecorderEnabled(),
        count: getRemodelDebugRecords().length,
      })
    }, 1000)
  }

  componentWillUnmount() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }
  }

  toggleRecorder = () => {
    const enabled = !isRemodelDebugRecorderEnabled()
    setRemodelDebugRecorderEnabled(enabled)
    this.setState({ enabled })
  }

  clearRecords = () => {
    clearRemodelDebugRecords()
    this.setState({ count: 0 })
  }

  exportRecords = () => {
    exportRemodelDebugRecords()
  }

  render(): ReactNode {
    const { enabled, count } = this.state

    return React.createElement(
      'div',
      {
        style: createStyle({
          display: 'grid',
          gap: 8,
          lineHeight: 1.5,
          maxWidth: 640,
        }),
      },
      React.createElement('h4', null, 'Remodel recipe debug recorder'),
      React.createElement(
        'p',
        null,
        'Opt-in local recorder for validating Akashi remodel API sequences. It captures only allowlisted remodel fields, keeps records in memory, and writes a file only when Export is clicked.',
      ),
      React.createElement(
        'label',
        null,
        React.createElement('input', {
          checked: enabled,
          onChange: this.toggleRecorder,
          type: 'checkbox',
        }),
        ' Enable remodel debug recorder',
      ),
      React.createElement('p', null, `Captured records: ${count}`),
      React.createElement(
        'div',
        {
          style: createStyle({
            display: 'flex',
            gap: 8,
          }),
        },
        React.createElement(
          'button',
          {
            disabled: count === 0,
            onClick: this.exportRecords,
            type: 'button',
          },
          'Export',
        ),
        React.createElement(
          'button',
          {
            disabled: count === 0,
            onClick: this.clearRecords,
            type: 'button',
          },
          'Clear',
        ),
      ),
    )
  }
}
