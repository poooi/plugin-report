import type { ReactElement } from 'react'

import RemodelDebugSettings from './remodel-debug-settings'
import {
  clearRemodelDebugRecords,
  recordRemodelDebugEvent,
  setRemodelDebugRecorderEnabled,
} from './remodel-debug-recorder'

type StoryRender = () => ReactElement

const resetRecorder = (enabled: boolean): void => {
  setRemodelDebugRecorderEnabled(enabled)
  clearRemodelDebugRecords()
}

const withRecorderState =
  (setup: () => void) =>
  (Story: StoryRender): ReactElement => {
    setup()
    return <Story />
  }

const meta = {
  title: 'Plugin/RemodelDebugSettings',
  component: RemodelDebugSettings,
  decorators: [
    (Story: StoryRender) => (
      <div
        style={{
          maxWidth: 720,
          padding: 16,
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default meta

interface Story {
  decorators: Array<(Story: StoryRender) => ReactElement>
}

export const Empty: Story = {
  decorators: [withRecorderState(() => resetRecorder(false))],
}

export const EnabledWithCapture: Story = {
  decorators: [
    withRecorderState(() => {
      resetRecorder(true)
      recordRemodelDebugEvent({
        time: Date.UTC(2026, 6, 3, 15),
        method: 'POST',
        path: '/kcsapi/api_req_kousyou/remodel_slotlist_detail',
        postBody: {
          api_id: '33',
          api_slot_id: '501',
          api_token: 'redacted by sanitizer',
        },
        body: {
          api_req_buildkit: 3,
          api_req_remodelkit: 4,
          api_certain_buildkit: 5,
          api_certain_remodelkit: 6,
        },
      })
    }),
  ],
}
