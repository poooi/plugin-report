import React, { type CSSProperties, type ReactElement, useEffect, useState } from 'react'
import {
  clearRemodelDebugRecords,
  exportRemodelDebugRecords,
  getRemodelDebugRecords,
  isRemodelDebugRecorderEnabled,
  setRemodelDebugRecorderEnabled,
  subscribeRemodelDebugRecorder,
} from './remodel-debug-recorder'

const rootStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  lineHeight: 1.5,
  maxWidth: 640,
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
}

const getRecorderState = () => ({
  enabled: isRemodelDebugRecorderEnabled(),
  count: getRemodelDebugRecords().length,
})

export default function RemodelDebugSettings(): ReactElement {
  const [recorderState, setRecorderState] = useState(getRecorderState)

  useEffect(() => subscribeRemodelDebugRecorder(() => setRecorderState(getRecorderState())), [])

  const toggleRecorder = () => {
    setRemodelDebugRecorderEnabled(!isRemodelDebugRecorderEnabled())
  }

  const clearRecords = () => {
    clearRemodelDebugRecords()
  }

  return React.createElement(
    'div',
    { style: rootStyle },
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
        checked: recorderState.enabled,
        onChange: toggleRecorder,
        type: 'checkbox',
      }),
      ' Enable remodel debug recorder',
    ),
    React.createElement('p', null, `Captured records: ${recorderState.count}`),
    React.createElement(
      'div',
      { style: buttonRowStyle },
      React.createElement(
        'button',
        {
          disabled: recorderState.count === 0,
          onClick: exportRemodelDebugRecords,
          type: 'button',
        },
        'Export',
      ),
      React.createElement(
        'button',
        {
          disabled: recorderState.count === 0,
          onClick: clearRecords,
          type: 'button',
        },
        'Clear',
      ),
    ),
  )
}
