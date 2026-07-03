import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  attachReportSpy,
  QuestReporter,
  resetReporterTestState,
} from '../helpers/reporter-test-harness'

beforeEach(resetReporterTestState)

describe('QuestReporter', () => {
  it('reports unknown quests and selected quest rewards', () => {
    const reporter = new QuestReporter()
    reporter.enabled = true
    reporter.knownQuests = []
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/questlist', {
      api_list: [
        {
          api_no: 101,
          api_title: 'Sortie',
          api_detail: 'Win once',
          api_category: 2,
          api_type: 3,
        },
      ],
    })
    expect(report).toHaveBeenCalledWith('/api/report/v3/quest', {
      quests: [
        {
          questId: 101,
          title: 'Sortie',
          detail: 'Win once',
          category: 2,
          type: 3,
        },
      ],
    })

    report.mockClear()
    reporter.handle(
      'POST',
      '/kcsapi/api_req_quest/clearitemget',
      {
        api_material: [1, 2, 3, 4],
        api_bounus: [{ api_type: 1 }],
        api_bounus_count: 1,
      },
      {
        api_quest_id: '101',
        api_select_no: '3',
        api_select_no2: '7',
      },
    )

    expect(report).toHaveBeenCalledWith('/api/report/v3/quest_reward', {
      selections: [3, 7],
      material: [1, 2, 3, 4],
      bonus: [{ api_type: 1 }],
      bounsCount: 1,
      questId: 101,
      title: 'Sortie',
      detail: 'Win once',
      category: 2,
      type: 3,
    })
  })

  it('does not report known quests again', () => {
    const reporter = new QuestReporter()
    reporter.enabled = true
    const knownHash = createHash('md5').update('SortieWin once').digest('hex')
    reporter.knownQuests = [knownHash.slice(0, 8)]
    const report = attachReportSpy(reporter)

    reporter.handle('GET', '/kcsapi/api_get_member/questlist', {
      api_list: [
        {
          api_no: 101,
          api_title: 'Sortie',
          api_detail: 'Win once',
          api_category: 2,
          api_type: 3,
        },
      ],
    })

    expect(report).not.toHaveBeenCalled()
  })
})
