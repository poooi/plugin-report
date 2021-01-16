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

    if (quests) {
      this.knownQuests = quests
      this.enabled = true
    }
  }

  handle(method, path, body, postBody) {
    if (!this.enabled) {
      return
    }
    if (path === '/kcsapi/api_get_member/questlist') {
      _.each(body.api_list, quest => {
        if (this.knownQuests.includes(quest.api_no)) {
          return
        }

        this.knownQuests.push(quest.api_no)
        this.report(`/api/report/v2/quest/${quest.api_no}`, {
          questId: quest.api_no,
          title: quest.api_title,
          detail: quest.api_detail,
          category: quest.api_category,
          type: quest.api_type,
        })
      })
    }
  }
}
