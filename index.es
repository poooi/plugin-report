import url from 'url'
import _ from 'lodash'
import Promise from 'bluebird'
import request from 'request'
import moment from 'moment'

Promise.promisifyAll(request)
const { SERVER_HOSTNAME } = window
// const SERVER_HOSTNAME = '127.0.0.1:17027'

class BaseReporter {
  constructor() {
    const _package = require('./package.json')
    this.USERAGENT = `Reporter v${_package.version}`
  }

  report = async (path, info) => {
    try {
      await request.postAsync(
        url.resolve(`http://${SERVER_HOSTNAME}`, path),
        {
          headers: {
            'User-Agent': this.USERAGENT,
          },
          form: {
            data: JSON.stringify(info),
          },
        }
      )
    }
    catch (err) {
      console.error(err.stack)
    }
  }
}

class QuestReporter extends BaseReporter {
  constructor() {
    super()

    this.knownQuests = []
    this.enabled = false

    request.get(
      url.resolve(`http://${SERVER_HOSTNAME}`, '/api/report/v2/known_quests'),
      (err, response, body) => {
        if (err != null || response.statusCode != 200)
          return
        this.knownQuests = JSON.parse(body).quests
        this.enabled = true
      }
    )
  }
  handle(method, path, body, postBody) {
    if (!this.enabled)
      return
    if (path === '/kcsapi/api_get_member/questlist') {
      if (body.api_list == null) return
      for (const quest of body.api_list) {
        if (quest === -1) continue
        if (_.indexOf(this.knownQuests, quest.api_no, true) != -1) continue
        this.knownQuests.push(quest.api_no)
        this.knownQuests.sort()
        this.report(`/api/report/v2/quest/${quest.api_no}`, {
          questId : quest.api_no,
          title   : quest.api_title,
          detail  : quest.api_detail,
          category: quest.api_category,
          type    : quest.api_type,
        })
      }
    }
  }
}

class CreateShipReporter extends BaseReporter {
  constructor() {
    super()

    this.creating = false
    this.kdockId  = -1
    this.info     = null
  }
  handle(method, path, body, postBody) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createship') {
      this.creating = true
      this.kdockId = parseInt(postBody.api_kdock_id) - 1
      const secretaryIdx = _decks[0].api_ship[0]
      this.info = {
        items: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4), parseInt(postBody.api_item5)],
        kdockId  : this.kdockId,
        largeFlag: parseInt(postBody.api_large_flag) != 0,
        highspeed: parseInt(postBody.api_highspeed),
        secretary: _ships[secretaryIdx].api_ship_id,
        teitokuLv: _teitokuLv,
        shipId   : -1,
      }
    }
    if (path === '/kcsapi/api_get_member/kdock') {
      if (!this.creating) return
      const { info } = this
      const dock = body[this.kdockId]
      if (dock.api_item1 != info.items[0] || dock.api_item2 != info.items[1] || dock.api_item3 != info.items[2] || dock.api_item4 != info.items[3] || dock.api_item5 != info.items[4]) return
      info.shipId = dock.api_created_ship_id
      this.creating = false
      this.report("/api/report/v2/create_ship", info)
    }
  }
}

class CreateItemReporter extends BaseReporter {
  handle(method, path, body, postBody) {
    const { _decks, _ships, _teitokuLv } = window
    if (path === '/kcsapi/api_req_kousyou/createitem') {
      const secretaryIdx = _decks[0].api_ship[0]
      this.report("/api/report/v2/create_item", {
        items: [parseInt(postBody.api_item1), parseInt(postBody.api_item2), parseInt(postBody.api_item3), parseInt(postBody.api_item4)],
        itemId   : body.api_create_flag == 1 ? body.api_slot_item.api_slotitem_id : parseInt(body.api_fdata.split(',')[1]),
        teitokuLv: _teitokuLv,
        secretary: _ships[secretaryIdx].api_ship_id,
        successful: body.api_create_flag == 1,
      })
    }
  }
}

class DropShipReporter extends BaseReporter {
  constructor() {
    super()

    this.mapLv = []
    this.drop = null
  }
  handle(method, path, body, postBody) {
    const { mapLv } = this
    const { _teitokuId, _teitokuLv, _nickName } = window
    switch(path) {
    case '/kcsapi/api_get_member/mapinfo': {
      for (const map of body.api_map_info) {
        mapLv[map.api_id] = 0
        if (map.api_eventmap != null)
          mapLv[map.api_id] = map.api_eventmap.api_selected_rank
      }
    } break
    case '/kcsapi/api_req_map/select_eventmap_rank': {
      const mapareaId = parseInt(postBody.api_maparea_id) * 10 + parseInt(postBody.api_map_no)
      const rank = parseInt(postBody.api_rank)
      mapLv[mapareaId] = parseInt(postBody.api_rank)
      // Report select map difficulty
      this.report("/api/report/v2/select_rank", {
        teitokuId: _teitokuId,
        teitokuLv: _teitokuLv,
        mapareaId: mapareaId,
        rank: rank,
      })
    } break
    case '/kcsapi/api_req_map/start':
    case '/kcsapi/api_req_map/next': {
      const drop = {
        mapId : null,
        cellId: null,
        isBoss: null,
        mapLv : null,
        enemy : null,
        enemyShips: null,
        enemyFormation: null,
        quest : null,
        rank  : null,
        shipId: null,
        itemId: null,
        teitokuLv: null,
      }
      drop.mapId  = body.api_maparea_id * 10 + body.api_mapinfo_no
      drop.cellId = body.api_no
      drop.isBoss = body.api_event_id == 5
      drop.mapLv  = mapLv[drop.mapId]
      this.drop = drop
    } break
    case '/kcsapi/api_req_sortie/battle':
    case '/kcsapi/api_req_sortie/airbattle':
    case '/kcsapi/api_req_sortie/ld_airbattle':
    case '/kcsapi/api_req_combined_battle/battle':
    case '/kcsapi/api_req_combined_battle/battle_water':
    case '/kcsapi/api_req_combined_battle/airbattle':
    case '/kcsapi/api_req_combined_battle/ld_airbattle':
    case '/kcsapi/api_req_combined_battle/ec_battle':
    case '/kcsapi/api_req_combined_battle/each_battle':
    case '/kcsapi/api_req_combined_battle/each_battle_water':
    case '/kcsapi/api_req_battle_midnight/sp_midnight':
    case '/kcsapi/api_req_combined_battle/sp_midnight': {
      const { drop } = this
      drop.enemyShips = []
      for (const ships of [body.api_ship_ke, body.api_ship_ke_combined]) {
        if (ships != null)
          drop.enemyShips = drop.enemyShips.concat(ships.slice(1, 7))
      }
      drop.enemyFormation = body.api_formation[1]
    } break
    case '/kcsapi/api_req_sortie/battleresult':
    case '/kcsapi/api_req_combined_battle/battleresult': {
      const { drop } = this
      drop.enemy = body.api_enemy_info.api_deck_name
      drop.quest = body.api_quest_name
      drop.rank = body.api_win_rank
      drop.shipId = (body.api_get_ship || {}).api_ship_id || -1
      drop.itemId = (body.api_get_useitem || {}).api_useitem_id || -1
      drop.teitokuLv = _teitokuLv
      this.report('/api/report/v2/drop_ship', drop)
      // Report pass event
      if (body.api_get_eventitem != null) {
        this.report('/api/report/v2/pass_event', {
          teitokuId: _teitokuId,
          teitokuLv: _teitokuLv,
          teitoku: _nickName,
          mapId: drop.mapId,
          mapLv: drop.mapLv,
        })
      }
    } break
    }
  }
}

class BattleAPIReporter extends BaseReporter {
  constructor() {
    super()
    this.BATTLE_PATH = [
      '/kcsapi/api_req_practice/battle',
      '/kcsapi/api_req_sortie/battle',
      '/kcsapi/api_req_sortie/airbattle',
      '/kcsapi/api_req_sortie/ld_airbattle',
      '/kcsapi/api_req_combined_battle/battle',
      '/kcsapi/api_req_combined_battle/battle_water',
      '/kcsapi/api_req_combined_battle/airbattle',
      '/kcsapi/api_req_combined_battle/ld_airbattle',
      '/kcsapi/api_req_combined_battle/ec_battle',
      '/kcsapi/api_req_combined_battle/each_battle',
      '/kcsapi/api_req_combined_battle/each_battle_water',
      '/kcsapi/api_req_practice/midnight_battle',
      '/kcsapi/api_req_battle_midnight/battle',
      '/kcsapi/api_req_battle_midnight/sp_midnight',
      '/kcsapi/api_req_combined_battle/midnight_battle',
      '/kcsapi/api_req_combined_battle/sp_midnight',
      '/kcsapi/api_req_combined_battle/ec_midnight_battle',
    ]
    this.BATTLE_KEYS = [
      'api_active_deck',
      'api_dock_id', 'api_deck_id',
      'api_ship_ke', 'api_ship_ke_combined',
      'api_ship_lv', 'api_ship_lv_combined',
      'api_nowhps',  'api_nowhps_combined',
      'api_maxhps',  'api_maxhps_combined',
      'api_eSlot',   'api_eSlot_combined',
      'api_eKyouka', 'api_eKyouka_combined',  // Currently ~_combined not found
      'api_fParam',  'api_fParam_combined',
      'api_eParam',  'api_eParam_combined',
      'api_midnight_flag',
      'api_boss_damaged',  'api_xal01',
      'api_escape_idx',    'api_escape_idx_combined',
      'api_combat_ration', 'api_combat_ration_combined',
      'api_search',        'api_formation',
      'api_touch_plane',   'api_flare_pos',
      'api_air_base_injection',
      'api_air_base_attack',
      'api_injection_kouku',
      'api_stage_flag',          'api_kouku',
      'api_stage_flag2',         'api_kouku2',
      'api_support_flag',        'api_support_info',
      'api_opening_taisen_flag', 'api_opening_taisen',
      'api_opening_flag',        'api_opening_atack',
      'api_hourai_flag',
      'api_hougeki1', 'api_hougeki2', 'api_hougeki3',
      'api_raigeki',
      'api_hougeki',
    ]
  }
  handle(method, path, body, postBody) {
    if (this.BATTLE_PATH.includes(path)) {
      const data = {}
      _.forIn(body, (value, key) => {
        if (value == null)
          return
        if (!this.BATTLE_KEYS.includes(key))
          data[key] = value
      })
      if (Object.keys(data).length > 0) {
        this.BATTLE_KEYS.concat(Object.keys(data))
        this.report("/api/report/v2/battle_api", {path, data})
      }
    }
  }
}

// Stopped at 2016.11.28. We have collected 800k records.
class RemodelItemReporter extends BaseReporter {
  constructor() {
    super()
    this.itemId = -1
    this.itemLv = -1
  }
  handle(method, path, body, postBody) {
    const { _decks, _ships, _slotitems, _teitokuLv } = window
    switch(path) {
    case '/kcsapi/api_req_kousyou/remodel_slotlist_detail': {
      this.itemId = postBody.api_slot_id
      this.itemLv = _slotitems[this.itemId].api_level
    } break
    case '/kcsapi/api_req_kousyou/remodel_slot': {
      if (this.itemId != postBody.api_slot_id) {
        console.error(`Inconsistent remodel item data: #{this.itemId}, #{postBody.api_slot_id}`)
        return
      }
      const flagship = _ships[_decks[0].api_ship[0]]
      const consort  = _ships[_decks[0].api_ship[1]]
      this.report("/api/report/v2/remodel_item", {
        successful: body.api_remodel_flag,
        itemId: body.api_remodel_id[0],
        itemLevel: this.itemId,
        flagshipId: flagship.api_ship_id,
        flagshipLevel: flagship.api_lv,
        flagshipCond: flagship.api_cond,
        consortId: consort.api_ship_id,
        consortLevel: consort.api_lv,
        consortCond: consort.api_cond,
        teitokuLv: _teitokuLv,
        certain: postBody.api_certain_flag,
      })
    } break
    }
  }
}

const getStage = (level) => {
  switch (true) {
  case (level >= 0 && level < 6):
    return 0
  case (level >= 6 && level < 10):
    return 1
  case (level == 10):
    return 2
  default:
    return -1
  }
}

const COMMON_RECIPES = [101, 201, 301]

const getRecipeKey = ({ recipeId, itemId, stage, day, secretary }) =>
  `r${recipeId}-e${itemId}-s${stage}-d${day}-s${secretary}`

// Collecting remodel recipes
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
class RemodelRecipeReporter extends BaseReporter {
  constructor() {
    super()
    this.id = -1
    this.itemId = -1
    this.recipes = {}
  }
  handle(method, path, body, postBody) {
    const { _slotitems } = window
    switch(path) {
    case '/kcsapi/api_req_kousyou/remodel_slotlist': {
      this.recipes = _.keyBy(body, 'api_id')
    } break
    case '/kcsapi/api_req_kousyou/remodel_slotlist_detail': {
      const utc = moment.utc()
      const hour = utc.hour()
      const day = utc.day()
      // remodel list refreshes at 00:00 UTC+9
      this.day = hour >= 15 ? (day + 1) % 7 : day

      this.recipeId = parseInt(postBody.api_id)

      if (COMMON_RECIPES.includes(this.recipeId)) {
        return
      }

      let itemSlotId = postBody.api_slot_id
      this.itemId = (_slotitems[itemSlotId] || {}).api_slotitem_id || -1
      const itemLevel = (_slotitems[itemSlotId] || {}).api_level || -1
      this.stage = getStage(itemLevel)
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
    } break
    case '/kcsapi/api_req_kousyou/remodel_slot': {
      if (this.itemId != body.api_remodel_id[0]) {
        console.error(`Inconsistent remodel item data: ${this.itemId}, ${postBody.api_slot_id}`)
        return
      }
      if (this.recipeId != postBody.api_id) {
        console.error(`Inconsistent remodel item data: ${this.recipeId}, ${postBody.api_id}`)
        return
      }

      // unsuccessful upgrade will be noise for upgrade item record
      if (!body.api_remodel_flag) {
        return
      }

      const upgradeToItemId = body.api_remodel_id[1] != this.itemId ? body.api_remodel_id[1] : -1
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
        key: `r${this.recipeId}-e${this.itemId}-s${this.stage}-d${this.day}-s${secretary}`,
      }
      this.report('/api/report/v2/remodel_recipe', info)
    } break
    }
  }
}



// Collect night contact data with followed conditions:
// 1. Non-combined fleet
// 2. Only one contactable plane equipped.
// 3. Plane level must be equal or larger than 0.
// 4. Plane count must larger than 0.
class NightContactReportor extends BaseReporter {
  constructor() {
    super()
    this.VALID_PLANE_ID = 102
    this.isValid = null
  }
  handle(method, path, body, postBody) {
    switch(path) {
    case '/kcsapi/api_req_sortie/battle':
    case '/kcsapi/api_req_sortie/airbattle':
    case '/kcsapi/api_req_sortie/ld_airbattle': {
      const stage1 = _.get(body, 'api_kouku.api_stage1')
      const planeCount = (stage1.api_f_count || 0) + (stage1.api_e_count || 0)
      this.isValid = (
        body.api_midnight_flag === 1 && planeCount > 0 &&
        [1, 2, 3].includes(stage1.api_disp_seiku))
    } break
    case '/kcsapi/api_req_battle_midnight/sp_midnight': {
      this.isValid = true
    } // eslint-disable-next-line no-fallthrough
    case '/kcsapi/api_req_battle_midnight/battle': {
      if (this.isValid === false)
        break
      const { _decks, _ships, _slotitems } = window
      const touchId = (body.api_touch_plane || [-1, -1])[0]

      const entries = []  // Array of [ship, item] pairs
      const deck  = _decks[body.api_deck_id - 1] || {}
      const ships = deck.api_ship || []
      for (const sid of ships) {
        const ship = _ships[sid] || {}
        const items = ship.api_slot || []
        const count = ship.api_onslot || []
        for (const [iid, cnt] of _.zip(items, count)) {
          const item = _slotitems[iid] || {}
          // Condition * & 4
          if (item.api_slotitem_id === this.VALID_PLANE_ID && cnt > 0)
            entries.push([ship, item])
        }
      }
      if (! (entries.length === 1))  // Condition 2
        break

      const [ship, item] = entries[0]
      const info = {
        fleetType: 0,
        shipId: ship.api_ship_id,
        shipLv: ship.api_lv,
        itemId: item.api_slotitem_id,
        itemLv: item.api_level,
        contact: touchId > -1,
      }
      if (! (0 <= info.itemLv && info.itemLv <= 10 ))  // Condition 3
        break

      // Prevent reporting data with null value.
      for (const k of Object.keys(info)) {
        if (info[k] == null)
          break
      }
      this.report("/api/report/v2/night_contcat", info)
    } break
    }
  }
}


let reporters = []
const handleResponse = (e) => {
  const {method, path, body, postBody} = e.detail
  for (const reporter of reporters) {
    try {
      reporter.handle(method, path, body, postBody)
    }
    catch (err) {
      console.error(err.stack)
    }
  }
}

export const show = false
export const pluginDidLoad = (e) => {
  reporters = [
    new QuestReporter(),
    new CreateShipReporter(),
    new CreateItemReporter(),
    new DropShipReporter(),
    new BattleAPIReporter(),
    new NightContactReportor(),
    new RemodelRecipeReporter(),
  ]
  window.addEventListener('game.response', handleResponse)
}
export const pluginWillUnload = (e) => {
  window.removeEventListener('game.response', handleResponse)
}
