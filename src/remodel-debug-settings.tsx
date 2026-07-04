import { type CSSProperties, type ReactElement, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clearRemodelDebugRecords,
  getRemodelDebugRecordCount,
  exportRemodelDebugRecords,
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
  count: getRemodelDebugRecordCount(),
})

export default function RemodelDebugSettings(): ReactElement {
  const { t } = useTranslation('poi-plugin-report')
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
      <h4>{t('Remodel recipe debug recorder')}</h4>
      <p>{t('Remodel recipe debug recorder description')}</p>
      <label>
        <input checked={recorderState.enabled} onChange={toggleRecorder} type="checkbox" />{' '}
        {t('Enable remodel debug recorder')}
      </label>
      <p>{t('Captured records', { count: recorderState.count })}</p>
      <div style={buttonRowStyle}>
        <button
          disabled={recorderState.count === 0}
          onClick={exportRemodelDebugRecords}
          type="button"
        >
          {t('Export')}
        </button>
        <button disabled={recorderState.count === 0} onClick={clearRecords} type="button">
          {t('Clear')}
        </button>
      </div>
    </div>
  )
}
