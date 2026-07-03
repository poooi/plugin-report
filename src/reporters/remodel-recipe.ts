import moment from 'moment-timezone'
import _ from 'lodash'
import BaseReporter from './base'
import type { APIReqKousyouRemodelSlotRequest } from 'kcsapi/api_req_kousyou/remodel_slot/request'
import type { APIReqKousyouRemodelSlotResponse } from 'kcsapi/api_req_kousyou/remodel_slot/response'
import type { APIReqKousyouRemodelSlotlistResponse } from 'kcsapi/api_req_kousyou/remodel_slotlist/response'
import type { APIReqKousyouRemodelSlotlistDetailRequest } from 'kcsapi/api_req_kousyou/remodel_slotlist_detail/request'
import type { APIReqKousyouRemodelSlotlistDetailResponse } from 'kcsapi/api_req_kousyou/remodel_slotlist_detail/response'
import type {
  GameApiMethod,
  GameApiPath,
  GameApiPostBody,
  GameApiResponseBody,
} from '../types/game-api'

type RemodelRecipeListItem = Pick<
  APIReqKousyouRemodelSlotlistResponse,
  'api_id' | 'api_req_bauxite' | 'api_req_bull' | 'api_req_fuel' | 'api_req_steel'
> &
  Partial<Pick<APIReqKousyouRemodelSlotlistResponse, 'api_req_buildkit' | 'api_req_remodelkit'>>

type RemodelRecipeDetailPostBody = Pick<APIReqKousyouRemodelSlotlistDetailRequest, 'api_id'> & {
  api_slot_id: string | number
}

type RemodelRecipeDetailBody = Partial<
  Pick<
    APIReqKousyouRemodelSlotlistDetailResponse,
    | 'api_certain_buildkit'
    | 'api_certain_remodelkit'
    | 'api_req_buildkit'
    | 'api_req_remodelkit'
    | 'api_req_slot_id'
    | 'api_req_slot_num'
  >
>

type RemodelRecipeSlotPostBody = {
  api_id: string | number
} & Partial<Pick<APIReqKousyouRemodelSlotRequest, 'api_slot_id'>>

type RemodelRecipeSlotBody = Pick<
  APIReqKousyouRemodelSlotResponse,
  'api_remodel_id' | 'api_voice_ship_id'
> & {
  api_after_slot?: {
    api_level?: number
  }
  api_remodel_flag: boolean | number
}

interface RemodelRecipeReportPayload {
  recipeId: number
  itemId: number
  stage: number
  day: number
  secretary: number
  fuel: number
  ammo: number
  steel: number
  bauxite: number
  reqItemId: number
  reqItemCount: number
  buildkit: number
  remodelkit: number
  certainBuildkit: number
  certainRemodelkit: number
  upgradeToItemId: number
  upgradeToItemLevel: number
  key: string
}

// Collecting remodel recipes
export default class RemodelRecipeReporter extends BaseReporter {
  id: number
  itemId: number
  recipeId: number
  recipes: Record<number, RemodelRecipeListItem>
  day: number
  stage: number
  fuel: number | undefined
  ammo: number
  steel: number
  bauxite: number
  reqItemId: number
  reqItemCount: number
  buildkit: number
  remodelkit: number
  certainBuildkit: number
  certainRemodelkit: number

  // a recipe =
  //   id -> /kcsapi/api_req_kousyou/remodel_slotlist_detail postBody.api_id,
  //   itemId -> /kcsapi/api_req_kousyou/remodel_slotlist_detail postBody.api_slot_id, _slotitems
  //   stage -> based on item level, /kcsapi/api_req_kousyou/remodel_slotlist_detail postBody.api_slot_id, _slotitems
  //     [0,6) = 0, [6, 10) = 1, 10 = 2
  //   upgradeToItemId -> /kcsapi/api_req_kousyou/remodel_slot body.body.api_remodel_id[1]
  //   upgradeToItemLevel -> /kcsapi/api_req_kousyou/remodel_slot body.api_after_slot
  //   day of the week -> moment.js
  //   secretary (actually the second slot kanmusu)  -> api_req_kousyou/remodel_slot  api_voice_ship_id
  //   fuel -> /kcsapi/api_req_kousyou/remodel_slotlist_detail postBody.api_id,
  //     /kcsapi/api_req_kousyou/remodel_slotlist, body, api_req_*
  //   ammo -> similar to above
  //   steel -> similar to above
  //   bauxite -> similar to above
  //   reqItemId -> /kcsapi/api_req_kousyou/remodel_slotlist_detail body.api_req_slot_id
  //   reqItemCount -> /kcsapi/api_req_kousyou/remodel_slotlist_detail body.api_req_slot_num
  //   buildkit -> /kcsapi/api_req_kousyou/remodel_slotlist_detail body.api_req_buildkit
  //   remodelkit -> similar to above
  //   certainBuildkit -> similar to above
  //   certainRemodelkit -> similar to above
  constructor() {
    super()
    this.id = -1
    this.itemId = -1
    this.recipeId = -1
    this.recipes = {}
    this.day = -1
    this.stage = -1
    this.fuel = undefined
    this.ammo = 0
    this.steel = 0
    this.bauxite = 0
    this.reqItemId = -1
    this.reqItemCount = 0
    this.buildkit = 0
    this.remodelkit = 0
    this.certainBuildkit = 0
    this.certainRemodelkit = 0
  }
  getStage(level: number) {
    switch (true) {
      case level >= 0 && level < 6:
        return 0
      case level >= 6 && level < 10:
        return 1
      case level == 10:
        return 2
      default:
        return -1
    }
  }
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
  ) {
    switch (path) {
      case '/kcsapi/api_req_kousyou/remodel_slotlist':
        {
          this.recipes = _.keyBy(body as RemodelRecipeListItem[], 'api_id')
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slotlist_detail':
        {
          const response = body as RemodelRecipeDetailBody
          const request = postBody as RemodelRecipeDetailPostBody
          if (Object.keys(this.recipes).length === 0) {
            return
          }
          const utc = moment.utc()
          const hour = utc.hour()
          const day = utc.day()
          // remodel list refreshes at 00:00 UTC+9
          this.day = hour >= 15 ? (day + 1) % 7 : day

          this.recipeId = parseInt(request.api_id)

          const itemSlotId = request.api_slot_id
          this.itemId = (window._slotitems[itemSlotId] || {}).api_slotitem_id || -1
          const itemLevel = (window._slotitems[itemSlotId] || {}).api_level || -1
          this.stage = this.getStage(itemLevel)
          const recipe: Partial<RemodelRecipeListItem> = this.recipes[this.recipeId] || {}

          this.fuel = recipe.api_req_fuel || 0
          this.ammo = recipe.api_req_bull || 0
          this.steel = recipe.api_req_steel || 0
          this.bauxite = recipe.api_req_bauxite || 0

          this.reqItemId = response.api_req_slot_id || -1
          this.reqItemCount = response.api_req_slot_num || 0
          this.buildkit = response.api_req_buildkit || 0
          this.remodelkit = response.api_req_remodelkit || 0
          this.certainBuildkit = response.api_certain_buildkit || 0
          this.certainRemodelkit = response.api_certain_remodelkit || 0
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slot':
        {
          const response = body as RemodelRecipeSlotBody
          const request = postBody as RemodelRecipeSlotPostBody
          if (typeof this.fuel === 'undefined') {
            return
          }

          if (this.itemId != response.api_remodel_id[0]) {
            console.error(`Inconsistent remodel item data: ${this.itemId}, ${request.api_slot_id}`)
            return
          }
          if (this.recipeId != request.api_id) {
            console.error(`Inconsistent remodel item data: ${this.recipeId}, ${request.api_id}`)
            return
          }

          // unsuccessful upgrade will be noise for upgrade item record,
          // and common items with any ship will produce much more data
          // stage == -1 because /port will not update slotitems with api_level, they are
          // updated only when restarting game
          if (!response.api_remodel_flag || this.stage == -1) {
            return
          }

          const upgradeToItemId =
            response.api_remodel_id[1] != this.itemId ? response.api_remodel_id[1] : -1
          const afterSlot = response.api_after_slot || {}
          const upgradeToItemLevel = upgradeToItemId >= 0 ? (afterSlot.api_level ?? -1) : -1
          const secretary = response.api_voice_ship_id || -1

          const info: RemodelRecipeReportPayload = {
            recipeId: this.recipeId,
            itemId: this.itemId,
            stage: this.stage,
            day: this.day,
            secretary,
            fuel: this.fuel,
            ammo: this.ammo,
            steel: this.steel,
            bauxite: this.bauxite,
            reqItemId: this.reqItemId,
            reqItemCount: this.reqItemCount,
            buildkit: this.buildkit,
            remodelkit: this.remodelkit,
            certainBuildkit: this.certainBuildkit,
            certainRemodelkit: this.certainRemodelkit,
            upgradeToItemId,
            upgradeToItemLevel,
            key: `r${this.recipeId}-i${this.itemId}-s${this.stage}-d${this.day}-s${secretary}`,
          }

          void this.report('/api/report/v2/remodel_recipe', info)
        }
        break
    }
  }
}
