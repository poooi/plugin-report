import BaseReporter from './base'
import _ from 'lodash'
import crypto from 'crypto'

const createHash = _.memoize(text =>
  crypto
    .createHash('md5')
    .update(text)
    .digest('hex'),
)

const createQuestHash = (title, detail) => createHash(`${title}${detail}`)

export default class QuestReporter extends BaseReporter {
  constructor() {
    super()

    this.knownQuests = []
    this.enabled = false

    this.initialize()
  }

  initialize = async () => {
    const { quests } = await this.getJson('/api/report/v3/known_quests')

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
      const quests = _.filter(body.api_list, quest => {
        const hash = createQuestHash(quest.api_title, quest.api_detail)
        return !_.some(this.knownQuests, partial => hash.startsWith(partial))
      })

      if (quests.length) {
        this.report(`/api/report/v3/quest`, {
          quests: _.map(quests, quest => ({
            questId: quest.api_no,
            title: quest.api_title,
            detail: quest.api_detail,
            category: quest.api_category,
            type: quest.api_type,
          })),
        })
      }
    }
  }
}
