import { type CSSProperties, type ReactElement, useEffect, useState } from 'react'
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

  useEffect(() => {
    const unsubscribe = subscribeRemodelDebugRecorder(() => setRecorderState(getRecorderState()))
    return unsubscribe
  }, [])

  const toggleRecorder = () => {
    setRemodelDebugRecorderEnabled(!isRemodelDebugRecorderEnabled())
  }

  const clearRecords = () => {
    clearRemodelDebugRecords()
  }

  return (
    <div style={rootStyle}>
      <h4>Remodel recipe debug recorder</h4>
      <p>
        Opt-in local recorder for validating Akashi remodel API sequences. It captures only
        allowlisted remodel fields, keeps records in memory, and writes a file only when Export is
        clicked.
      </p>
      <label>
        <input checked={recorderState.enabled} onChange={toggleRecorder} type="checkbox" /> Enable
        remodel debug recorder
      </label>
      <p>Captured records: {recorderState.count}</p>
      <div style={buttonRowStyle}>
        <button
          disabled={recorderState.count === 0}
          onClick={exportRemodelDebugRecords}
          type="button"
        >
          Export
        </button>
        <button disabled={recorderState.count === 0} onClick={clearRecords} type="button">
          Clear
        </button>
      </div>
    </div>
  )
}
