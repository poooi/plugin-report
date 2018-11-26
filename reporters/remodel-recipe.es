import url from 'url'
import moment from 'moment-timezone'
import _ from 'lodash'
import BaseReporter from './base'

// Collecting remodel recipes
export default class RemodelRecipeReporter extends BaseReporter {
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

    this.knownRecipes = []
    this.enabled = false

    this.get(
      url.resolve(`http://${this.SERVER_HOSTNAME}`, '/api/report/v2/known_recipes'),
      (err, response, body) => {
        if (err != null || response.statusCode != 200) return
        this.knownRecipes = JSON.parse(body).recipes
        this.enabled = true
      },
    )
  }
  getStage(level) {
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
  handle(method, path, body, postBody) {
    switch (path) {
      case '/kcsapi/api_req_kousyou/remodel_slotlist':
        {
          this.recipes = _.keyBy(body, 'api_id')
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slotlist_detail':
        {
          if (Object.keys(this.recipes).length === 0) {
            return
          }
          const utc = moment.utc()
          const hour = utc.hour()
          const day = utc.day()
          // remodel list refreshes at 00:00 UTC+9
          this.day = hour >= 15 ? (day + 1) % 7 : day

          this.recipeId = parseInt(postBody.api_id)

          let itemSlotId = postBody.api_slot_id
          this.itemId = (window._slotitems[itemSlotId] || {}).api_slotitem_id || -1
          const itemLevel = (window._slotitems[itemSlotId] || {}).api_level || -1
          this.stage = this.getStage(itemLevel)
          const recipe = this.recipes[this.recipeId] || {}

          this.fuel = recipe.api_req_fuel || 0
          this.ammo = recipe.api_req_bull || 0
          this.steel = recipe.api_req_steel || 0
          this.bauxite = recipe.api_req_bauxite || 0

          this.reqItemId = body.api_req_slot_id || -1
          this.reqItemCount = body.api_req_slot_num || 0
          this.buildkit = body.api_req_buildkit || 0
          this.remodelkit = body.api_req_remodelkit || 0
          this.certainBuildkit = body.api_certain_buildkit || 0
          this.certainRemodelkit = body.api_certain_remodelkit || 0
        }
        break
      case '/kcsapi/api_req_kousyou/remodel_slot':
        {
          if (!this.enabled) {
            return
          }

          if (typeof this.fuel === 'undefined') {
            return
          }

          if (this.itemId != body.api_remodel_id[0]) {
            console.error(`Inconsistent remodel item data: ${this.itemId}, ${postBody.api_slot_id}`)
            return
          }
          if (this.recipeId != postBody.api_id) {
            console.error(`Inconsistent remodel item data: ${this.recipeId}, ${postBody.api_id}`)
            return
          }

          // unsuccessful upgrade will be noise for upgrade item record,
          // and common items with any ship will produce much more data
          // stage == -1 because /port will not update slotitems with api_level, they are
          // updated only when restarting game
          if (!body.api_remodel_flag || this.stage == -1) {
            return
          }

          const upgradeToItemId =
            body.api_remodel_id[1] != this.itemId ? body.api_remodel_id[1] : -1
          const afterSlot = body.api_after_slot || {}
          const upgradeToItemLevel = upgradeToItemId >= 0 ? afterSlot.api_level : -1
          const secretary = body.api_voice_ship_id || -1

          const info = {
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
          if (this.knownRecipes.includes(info.key)) {
            return
          }
          this.knownRecipes.push(info.key)

          this.report('/api/report/v2/remodel_recipe', info)
        }
        break
    }
  }
}
