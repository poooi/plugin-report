import BaseReporter from './base'
import _ from 'lodash'
import crypto from 'crypto'
import type { APIList } from 'kcsapi/api_get_member/questlist/response'
import type { APIReqQuestClearitemgetRequest } from 'kcsapi/api_req_quest/clearitemget/request'
import type { APIReqQuestClearitemgetResponse } from 'kcsapi/api_req_quest/clearitemget/response'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'

const createHash = _.memoize((text) => crypto.createHash('md5').update(text).digest('hex'))

const createQuestHash = (title: string, detail: string) => createHash(`${title}${detail}`)

type QuestListItem = Pick<
  APIList,
  'api_category' | 'api_detail' | 'api_no' | 'api_title' | 'api_type'
>

type QuestWithKey = QuestListItem & {
  key: string
}

interface QuestListResponseBody {
  api_list: QuestListItem[] | null
}

type QuestRewardPostBody = Pick<
  APIReqQuestClearitemgetRequest,
  'api_quest_id' | 'api_select_no' | 'api_select_no2'
> &
  Record<`api_select_no${number}`, string | undefined>

export default class QuestReporter extends BaseReporter {
  knownQuests: string[]
  enabled: boolean
  quests: QuestWithKey[]

  constructor() {
    super()

    this.knownQuests = []
    this.enabled = false
    this.quests = []

    this.initialize()
  }

  initialize = async () => {
    const { quests } = await this.getJson<{ quests?: string[] }>('/api/report/v3/known_quests')

    if (quests) {
      this.knownQuests = quests
      this.enabled = true
    }
  }

  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    if (!this.enabled) {
      return
    }
    if (path === '/kcsapi/api_get_member/questlist') {
      const response = body as QuestListResponseBody
      this.quests = _.map(response.api_list || [], (quest) => ({
        ...quest,
        key: createQuestHash(quest.api_title, quest.api_detail),
      }))

      const quests = _.filter(
        this.quests,
        ({ key }) => !_.some(this.knownQuests, (partial) => key.startsWith(partial)),
      )

      if (quests.length) {
        this.knownQuests = [
          ...this.knownQuests,
          ..._.map(quests, (quest) => createQuestHash(quest.api_title, quest.api_detail)),
        ]
        this.report(`/api/report/v3/quest`, {
          quests: _.map(quests, (quest) => ({
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
      const response = body as APIReqQuestClearitemgetResponse
      const request = postBody as QuestRewardPostBody
      const { api_quest_id, api_select_no } = request

      const questId = parseInt(api_quest_id, 10)
      const quest = _.find(this.quests, ({ api_no }) => api_no === questId)

      if (!quest) {
        return
      }

      const selections = _.map(
        _.compact([
          api_select_no,
          ..._.map(_.range(2, 10), (num) => request[`api_select_no${num}`]),
        ]),
        (num) => parseInt(num, 10),
      )

      this.report(`/api/report/v3/quest_reward`, {
        selections,
        material: response.api_material,
        bonus: response.api_bounus, // the typo here is by Tanaka
        bounsCount: response.api_bounus_count, // the typo here is by Tanaka
        questId,
        title: quest.api_title,
        detail: quest.api_detail,
        category: quest.api_category,
        type: quest.api_type,
      })
    }
  }
}
