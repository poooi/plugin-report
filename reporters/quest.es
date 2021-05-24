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
    this.quests = []

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
      this.quests = _.map(body.api_list, quest => ({
        ...quest,
        key: createQuestHash(quest.api_title, quest.api_detail),
      }))

      const quests = _.filter(
        this.quests,
        ({ key }) => !_.some(this.knownQuests, partial => key.startsWith(partial)),
      )

      if (quests.length) {
        this.knownQuests = [
          ...this.knownQuests,
          ..._.map(quests, quest => createQuestHash(quest.api_title, quest.api_detail)),
        ]
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

    if (path === '/kcsapi/api_req_quest/clearitemget') {
      const { api_quest_id, api_select_no } = postBody

      const questId = parseInt(api_quest_id, 10)
      const quest = _.find(this.quests, ({ api_no }) => api_no === questId)

      if (!quest) {
        return
      }

      const selections = _.map(
        _.compact([
          api_select_no,
          ..._.map(_.range(2, 10), num => postBody[`api_select_no${num}`]),
        ]),
        num => parseInt(num, 10),
      )

      this.report(`/api/report/v3/quest_reward`, {
        selections,
        material: body.api_material,
        bonus: body.api_bounus, // the typo here is by Tanaka
        bounsCount: body.api_bounus_count, // the typo here is by Tanaka
        questId,
        title: quest.api_title,
        detail: quest.api_detail,
        category: quest.api_category,
        type: quest.api_type,
      })
    }
  }
}
