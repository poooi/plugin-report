import BaseReporter from './base'
import _ from 'lodash'

export default class QuestReporter extends BaseReporter {
  constructor() {
    super()

    this.knownQuests = []
    this.enabled = false

    this.initialize()
  }

  initialize = async () => {
    const { quests } = await this.getJson('/api/report/v2/known_quests')

    if (_.size(quests)) {
      this.knownQuests = quests
      this.enabled = true
    }
  }

  handle(method, path, body, postBody) {
    if (!this.enabled) return
    if (path === '/kcsapi/api_get_member/questlist') {
      if (body.api_list == null) return
      for (const quest of body.api_list) {
        if (quest === -1) continue
        if (_.indexOf(this.knownQuests, quest.api_no, true) != -1) continue
        this.knownQuests.push(quest.api_no)
        this.knownQuests.sort()
        this.report(`/api/report/v2/quest/${quest.api_no}`, {
          questId: quest.api_no,
          title: quest.api_title,
          detail: quest.api_detail,
          category: quest.api_category,
          type: quest.api_type,
        })
      }
    }
  }
}
