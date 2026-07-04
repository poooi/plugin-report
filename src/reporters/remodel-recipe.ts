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
  'api_id' | 'api_req_bauxite' | 'api_req_bull' | 'api_req_fuel' | 'api_req_steel' | 'api_slot_id'
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
> & {
  api_change_flag?: number
  api_req_slot_id2?: number
  api_req_slot_num2?: number
  api_req_useitem_id?: number
  api_req_useitem_num?: number
  api_req_useitem_id2?: number
  api_req_useitem_num2?: number
}

type RemodelRecipeSlotPostBody = {
  api_id: string | number
} & Partial<Pick<APIReqKousyouRemodelSlotRequest, 'api_slot_id'>>

type RemodelRecipeSlotBody = Pick<
  APIReqKousyouRemodelSlotResponse,
  'api_remodel_id' | 'api_voice_ship_id'
> & {
  api_after_slot?: {
    api_slotitem_id?: number
    api_level?: number
  }
  api_remodel_flag: boolean | number
}

interface RequiredItem {
  id: number
  count: number
}

interface RemodelRecipeFleetContext {
  observedSecondShipId: number
  observedFlagshipId: number
}

interface ItemImprovementAvailabilityPayload {
  schemaVersion: 1
  source: 'list'
  clientObservedAt: number
  recipeId: number
  itemId: number
  day: number
  observedSecondShipId: number
  observedFlagshipId: number
  detailObserved: false
}

interface ItemImprovementCostPayload {
  schemaVersion: 1
  source: 'detail'
  clientObservedAt: number
  recipeId: number
  itemId: number
  itemLevel: number
  stage: number
  day: number
  observedSecondShipId: number
  observedFlagshipId: number
  fuel: number
  ammo: number
  steel: number
  bauxite: number
  buildkit: number
  remodelkit: number
  certainBuildkit: number
  certainRemodelkit: number
  reqSlotItems: RequiredItem[]
  reqUseItems: RequiredItem[]
  changeFlag: number
  detailObserved: true
}

interface ItemImprovementUpdatePayload {
  schemaVersion: 1
  source: 'execution'
  clientObservedAt: number
  recipeId: number
  itemId: number
  itemLevel: number
  day: number
  observedSecondShipId: number
  observedFlagshipId: number
  upgradeObserved: true
  upgradeToItemId: number
  upgradeToItemLevel: number
}

type CurrentDetail = ItemImprovementCostPayload & {
  slotId: string | number
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

const ITEM_IMPROVEMENT_RECIPE_REPORT_PATH = '/api/report/v3/item_improvement_recipe'

const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key)

const parseInt10 = (value: string | number): number => parseInt(String(value), 10)

const getJstDay = (time: number): number => {
  const date = new Date(time)
  const utcDay = date.getUTCDay()
  const utcHour = date.getUTCHours()
  return utcHour >= 15 ? (utcDay + 1) % 7 : utcDay
}

const normalizeRequiredPairs = (
  ...pairs: Array<{
    id: number | undefined
    count: number | undefined
    present: boolean
  }>
): RequiredItem[] => {
  const counts = new Map<number, number>()

  for (const { id, count, present } of pairs) {
    if (!present || (id === 0 && count === 0)) {
      continue
    }
    if (
      !Number.isInteger(id) ||
      !Number.isInteger(count) ||
      id == null ||
      count == null ||
      id <= 0 ||
      count <= 0
    ) {
      throw new Error(`Invalid required item pair: ${String(id)}/${String(count)}`)
    }
    counts.set(id, (counts.get(id) || 0) + count)
  }

  return [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => a.id - b.id)
}

const toCostPayload = (detail: CurrentDetail): ItemImprovementCostPayload => ({
  schemaVersion: detail.schemaVersion,
  source: detail.source,
  clientObservedAt: detail.clientObservedAt,
  recipeId: detail.recipeId,
  itemId: detail.itemId,
  itemLevel: detail.itemLevel,
  stage: detail.stage,
  day: detail.day,
  observedSecondShipId: detail.observedSecondShipId,
  observedFlagshipId: detail.observedFlagshipId,
  fuel: detail.fuel,
  ammo: detail.ammo,
  steel: detail.steel,
  bauxite: detail.bauxite,
  buildkit: detail.buildkit,
  remodelkit: detail.remodelkit,
  certainBuildkit: detail.certainBuildkit,
  certainRemodelkit: detail.certainRemodelkit,
  reqSlotItems: detail.reqSlotItems,
  reqUseItems: detail.reqUseItems,
  changeFlag: detail.changeFlag,
  detailObserved: detail.detailObserved,
})

// Collecting remodel recipes
export default class RemodelRecipeReporter extends BaseReporter {
  id: number
  itemId: number
  itemLevel: number
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
  currentDetail: CurrentDetail | undefined

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
    this.itemLevel = -1
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
    this.currentDetail = undefined
  }
  getStage(level: number, changeFlag = 0) {
    if (changeFlag) {
      return 2
    }
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

  getFleetContext(): RemodelRecipeFleetContext | undefined {
    const deck = window._decks[0]
    const flagshipRosterId = deck?.api_ship[0]
    if (flagshipRosterId == null || Number(flagshipRosterId) <= 0) {
      return undefined
    }

    const flagship = window._ships[flagshipRosterId]
    const observedFlagshipId = flagship?.api_ship_id
    if (!observedFlagshipId) {
      return undefined
    }

    const secondRosterId = deck?.api_ship[1]
    if (secondRosterId == null || Number(secondRosterId) <= 0) {
      return {
        observedSecondShipId: 0,
        observedFlagshipId,
      }
    }

    const secondShip = window._ships[secondRosterId]
    const observedSecondShipId = secondShip?.api_ship_id
    if (!observedSecondShipId) {
      return undefined
    }

    return {
      observedSecondShipId,
      observedFlagshipId,
    }
  }

  normalizeReqSlotItems(response: RemodelRecipeDetailBody): RequiredItem[] {
    return normalizeRequiredPairs(
      {
        id: response.api_req_slot_id,
        count: response.api_req_slot_num,
        present: hasOwn(response, 'api_req_slot_id') || hasOwn(response, 'api_req_slot_num'),
      },
      {
        id: response.api_req_slot_id2,
        count: response.api_req_slot_num2,
        present: hasOwn(response, 'api_req_slot_id2') || hasOwn(response, 'api_req_slot_num2'),
      },
    )
  }

  normalizeReqUseItems(response: RemodelRecipeDetailBody): RequiredItem[] {
    return normalizeRequiredPairs(
      {
        id: response.api_req_useitem_id,
        count: response.api_req_useitem_num,
        present: hasOwn(response, 'api_req_useitem_id') || hasOwn(response, 'api_req_useitem_num'),
      },
      {
        id: response.api_req_useitem_id2,
        count: response.api_req_useitem_num2,
        present:
          hasOwn(response, 'api_req_useitem_id2') || hasOwn(response, 'api_req_useitem_num2'),
      },
    )
  }

  hasExactDetailCosts(response: RemodelRecipeDetailBody): boolean {
    return (
      hasOwn(response, 'api_req_buildkit') &&
      hasOwn(response, 'api_req_remodelkit') &&
      hasOwn(response, 'api_certain_buildkit') &&
      hasOwn(response, 'api_certain_remodelkit')
    )
  }

  resetExecutionState() {
    this.currentDetail = undefined
    this.fuel = undefined
  }

  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
    time = Date.now(),
  ) {
    switch (path) {
      case '/kcsapi/api_req_kousyou/remodel_slotlist':
        {
          const response = body as RemodelRecipeListItem[]
          const day = getJstDay(time)
          const context = this.getFleetContext()
          this.recipes = _.keyBy(response, 'api_id')

          if (!context) {
            console.error('Invalid remodel recipe fleet context')
            return
          }

          const records = response
            .map((recipe): ItemImprovementAvailabilityPayload | undefined => {
              const recipeId = recipe.api_id
              const itemId = recipe.api_slot_id
              if (!Number.isInteger(recipeId) || !Number.isInteger(itemId)) {
                return undefined
              }
              return {
                schemaVersion: 1,
                source: 'list',
                clientObservedAt: time,
                recipeId,
                itemId,
                day,
                observedSecondShipId: context.observedSecondShipId,
                observedFlagshipId: context.observedFlagshipId,
                detailObserved: false,
              }
            })
            .filter((record): record is ItemImprovementAvailabilityPayload => record != null)

          if (records.length) {
            void this.report(ITEM_IMPROVEMENT_RECIPE_REPORT_PATH, { records })
          }
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slotlist_detail':
        {
          const response = body as RemodelRecipeDetailBody
          const request = postBody as RemodelRecipeDetailPostBody
          this.resetExecutionState()

          if (Object.keys(this.recipes).length === 0) {
            return
          }

          this.day = getJstDay(time)
          this.recipeId = parseInt10(request.api_id)
          if (!Number.isInteger(this.recipeId)) {
            console.error(`Invalid remodel recipe id: ${String(request.api_id)}`)
            return
          }

          const itemSlotId = request.api_slot_id
          const slotItem = window._slotitems[itemSlotId]
          this.itemId = slotItem?.api_slotitem_id ?? -1
          this.itemLevel = slotItem?.api_level ?? -1
          const changeFlag = response.api_change_flag ?? 0
          this.stage = this.getStage(this.itemLevel, changeFlag)
          if (this.itemId < 0 || this.stage < 0) {
            console.error('Invalid remodel recipe slot item data')
            return
          }

          const recipe: Partial<RemodelRecipeListItem> = this.recipes[this.recipeId] || {}
          const fuel = recipe.api_req_fuel
          const ammo = recipe.api_req_bull
          const steel = recipe.api_req_steel
          const bauxite = recipe.api_req_bauxite
          const buildkit = response.api_req_buildkit
          const remodelkit = response.api_req_remodelkit
          const certainBuildkit = response.api_certain_buildkit
          const certainRemodelkit = response.api_certain_remodelkit
          if (
            fuel == null ||
            ammo == null ||
            steel == null ||
            bauxite == null ||
            buildkit == null ||
            remodelkit == null ||
            certainBuildkit == null ||
            certainRemodelkit == null ||
            !this.hasExactDetailCosts(response)
          ) {
            console.error('Invalid remodel recipe detail data')
            return
          }

          this.fuel = fuel
          this.ammo = ammo
          this.steel = steel
          this.bauxite = bauxite

          this.reqItemId = response.api_req_slot_id || -1
          this.reqItemCount = response.api_req_slot_num || 0
          this.buildkit = buildkit
          this.remodelkit = remodelkit
          this.certainBuildkit = certainBuildkit
          this.certainRemodelkit = certainRemodelkit

          const context = this.getFleetContext()
          if (!context) {
            console.error('Invalid remodel recipe fleet context')
            return
          }

          let reqSlotItems: RequiredItem[]
          let reqUseItems: RequiredItem[]
          try {
            reqSlotItems = this.normalizeReqSlotItems(response)
            reqUseItems = this.normalizeReqUseItems(response)
          } catch (err) {
            console.error(err instanceof Error ? err.message : err)
            return
          }

          const detail: CurrentDetail = {
            schemaVersion: 1,
            source: 'detail',
            clientObservedAt: time,
            recipeId: this.recipeId,
            itemId: this.itemId,
            itemLevel: this.itemLevel,
            stage: this.stage,
            day: this.day,
            observedSecondShipId: context.observedSecondShipId,
            observedFlagshipId: context.observedFlagshipId,
            fuel: this.fuel,
            ammo: this.ammo,
            steel: this.steel,
            bauxite: this.bauxite,
            buildkit: this.buildkit,
            remodelkit: this.remodelkit,
            certainBuildkit: this.certainBuildkit,
            certainRemodelkit: this.certainRemodelkit,
            reqSlotItems,
            reqUseItems,
            changeFlag,
            detailObserved: true,
            slotId: itemSlotId,
          }
          this.currentDetail = detail

          void this.report(ITEM_IMPROVEMENT_RECIPE_REPORT_PATH, toCostPayload(detail))
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slot':
        {
          const response = body as RemodelRecipeSlotBody
          const request = postBody as RemodelRecipeSlotPostBody
          if (typeof this.fuel === 'undefined') {
            return
          }
          const currentDetail = this.currentDetail

          if (this.itemId != response.api_remodel_id[0]) {
            console.error(`Inconsistent remodel item data: ${this.itemId}, ${request.api_slot_id}`)
            this.resetExecutionState()
            return
          }
          if (this.recipeId != request.api_id) {
            console.error(`Inconsistent remodel item data: ${this.recipeId}, ${request.api_id}`)
            this.resetExecutionState()
            return
          }
          if (
            currentDetail &&
            request.api_slot_id != null &&
            currentDetail.slotId != request.api_slot_id
          ) {
            console.error(
              `Inconsistent remodel item data: ${currentDetail.slotId}, ${request.api_slot_id}`,
            )
            this.resetExecutionState()
            return
          }

          // unsuccessful upgrade will be noise for upgrade item record,
          // and common items with any ship will produce much more data
          // stage == -1 because /port will not update slotitems with api_level, they are
          // updated only when restarting game
          if (!response.api_remodel_flag || this.stage == -1) {
            this.resetExecutionState()
            return
          }

          const afterSlot = response.api_after_slot || {}
          const afterSlotItemId = afterSlot.api_slotitem_id
          const remodelTargetItemId = response.api_remodel_id[1]
          const upgradeToItemId =
            afterSlotItemId != null && afterSlotItemId !== this.itemId
              ? afterSlotItemId
              : remodelTargetItemId != null && remodelTargetItemId !== this.itemId
                ? remodelTargetItemId
                : -1
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

          if (currentDetail && upgradeToItemId >= 0 && upgradeToItemLevel >= 0) {
            const update: ItemImprovementUpdatePayload = {
              schemaVersion: 1,
              source: 'execution',
              clientObservedAt: currentDetail.clientObservedAt,
              recipeId: currentDetail.recipeId,
              itemId: currentDetail.itemId,
              itemLevel: currentDetail.itemLevel,
              day: currentDetail.day,
              observedSecondShipId: currentDetail.observedSecondShipId,
              observedFlagshipId: currentDetail.observedFlagshipId,
              upgradeObserved: true,
              upgradeToItemId,
              upgradeToItemLevel,
            }
            void this.report(ITEM_IMPROVEMENT_RECIPE_REPORT_PATH, update)
          }
          this.resetExecutionState()
        }
        break
    }
  }
}
