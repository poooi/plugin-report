import React from 'react'

import RemodelDebugSettings from './remodel-debug-settings'
import {
  clearRemodelDebugRecords,
  recordRemodelDebugEvent,
  setRemodelDebugRecorderEnabled,
} from './remodel-debug-recorder'

const meta = {
  title: 'Plugin/RemodelDebugSettings',
  component: RemodelDebugSettings,
  decorators: [
    (Story: () => React.ReactElement) =>
      React.createElement(
        'div',
        {
          style: {
            padding: 16,
            maxWidth: 720,
          },
        },
        React.createElement(Story),
      ),
  ],
}

export default meta

interface Story {
  beforeEach(): void
}

export const Empty: Story = {
  beforeEach() {
    setRemodelDebugRecorderEnabled(false)
    clearRemodelDebugRecords()
  },
}

export const EnabledWithCapture: Story = {
  beforeEach() {
    setRemodelDebugRecorderEnabled(true)
    clearRemodelDebugRecords()
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
  },
}
