import { createHash } from 'crypto'
import _ from 'lodash'

const hasAtLeast = num => f => xs => xs.filter(f).length >= num
const validAll = (...func) => x => func.every(f => f(x))
const validAny = (...func) => x => func.some(f => f(x))

const equipType2Is = num => equip => _.get(equip, 'api_type.2') === num
const equipType3Is = num => equip => _.get(equip, 'api_type.3') === num
const equipIdIs = num => equip => equip.api_slotitem_id === num

export const getHpStyle = percent => {
  if (percent <= 25) {
    return 'red'
  } else if (percent <= 50) {
    return 'orange'
  } else if (percent <= 75) {
    return 'yellow'
  } else {
    return 'green'
  }
}

// T = Torpedo
// LMT = Late Model Torpedo
// R = Radar

export const getNightBattleSSCIType = equips => {
  if (
    validAll(
      hasAtLeast(1)(equipType2Is(51)),
      hasAtLeast(1)(validAny(equipIdIs(213), equipIdIs(214))),
    )(equips)
  ) {
    return 'SS_LMT_R'
  }
  if (hasAtLeast(2)(validAny(equipIdIs(213), equipIdIs(214)))(equips)) {
    return 'SS_LMT_LMT'
  }
  if (
    validAny(
      hasAtLeast(1)(equipType2Is(51)),
      hasAtLeast(1)(validAny(equipIdIs(213), equipIdIs(214))),
    )(equips)
  ) {
    return 'SS_T_T'
  }

  return ''
}

const houmAboveOrEqual = num => equip => equip.api_houm >= num

// G_T_R = Gun Torpedo Radar
// T_R_P = Torpedo Radar Personnel
export const getNightBattleDDCIType = equips => {
  if (
    validAll(
      hasAtLeast(1)(equipType2Is(1)),
      hasAtLeast(1)(equipType2Is(5)),
      hasAtLeast(1)(validAll(validAny(equipType2Is(12), equipType2Is(13)), houmAboveOrEqual(3))),
    )(equips)
  ) {
    return 'DD_G_T_R'
  }

  if (
    validAll(
      hasAtLeast(1)(equipType2Is(5)),
      hasAtLeast(1)(equipIdIs(129)),
      hasAtLeast(1)(validAll(validAny(equipType2Is(12), equipType2Is(13)), houmAboveOrEqual(3))),
    )(equips)
  ) {
    return 'DD_T_R_P'
  }

  return ''
}

// NF = Fighter
// NB = Bomber
// B = Swordfish/Iwai Fighter-Bomber
// S = Suisei Model 12 (Type 31 Photoelectric Fuze Bombs)

export const getNightBattleCVCIType = equips => {
  if (validAll(hasAtLeast(2)(equipType3Is(45)), hasAtLeast(1)(equipType3Is(46)))(equips)) {
    return 'CV_NF_NF_NB'
  }

  if (validAll(hasAtLeast(3)(equipType3Is(45)))(equips)) {
    return 'CV_NF_NF_NF'
  }

  if (
    validAll(
      hasAtLeast(1)(equipType3Is(45)),
      hasAtLeast(1)(equipType3Is(46)),
      hasAtLeast(1)(validAny(equipIdIs(154), equipIdIs(242), equipIdIs(243), equipIdIs(244))),
    )(equips)
  ) {
    return 'CV_NF_NB_B'
  }

  if (
    validAll(
      hasAtLeast(2)(equipType3Is(45)),
      hasAtLeast(1)(validAny(equipIdIs(154), equipIdIs(242), equipIdIs(243), equipIdIs(244))),
    )(equips)
  ) {
    return 'CV_NF_NF_B'
  }

  if (
    validAll(
      hasAtLeast(1)(equipType3Is(45)),
      hasAtLeast(2)(validAny(equipIdIs(154), equipIdIs(242), equipIdIs(243), equipIdIs(244))),
    )(equips)
  ) {
    return 'CV_NF_B_B'
  }
  if (
    validAll(
      hasAtLeast(1)(equipType3Is(45)),
      hasAtLeast(1)(equipIdIs(154)),
      hasAtLeast(1)(equipIdIs(320)),
    )(equips)
  ) {
    return 'CV_NF_B_S'
  }
  if (validAll(hasAtLeast(1)(equipType3Is(45)), hasAtLeast(1)(equipType3Is(46)))(equips)) {
    return 'CV_NF_NB'
  }

  if (validAll(hasAtLeast(1)(equipType3Is(46)), hasAtLeast(1)(equipIdIs(320)))(equips)) {
    return 'CV_NB_S'
  }

  if (validAll(hasAtLeast(1)(equipType3Is(45)), hasAtLeast(1)(equipIdIs(320)))(equips)) {
    return 'CV_NF_S'
  }

  return ''
}

let teitokuId = window._teitokuId
let teitokuHash = null

export const getTeitokuHash = () => {
  const { _teitokuId, _nickName, _nickNameId } = window
  if (
    (teitokuId !== _teitokuId || !teitokuHash) &&
    _teitokuId !== -1 &&
    _nickName &&
    _nickNameId !== -1
  ) {
    teitokuId = _teitokuId
    teitokuHash = createHash('sha1')
      .update(`${_teitokuId}_${_nickName}_${_nickNameId}`)
      .digest('base64')
  }
  return teitokuHash
}

export const getOwnedShipSnapshot = () => {
  const ships = JSON.parse(JSON.stringify(window._ships))
  const $ships = JSON.parse(JSON.stringify(window.$ships))
  const yomiMap = _($ships)
    .groupBy('api_yomi')
    .mapValues(group => _.minBy(group, 'api_id').api_id)
    .value()

  return _(ships)
    .groupBy(s => $ships[s.api_ship_id].api_yomi)
    .mapKeys((__, yomi) => yomiMap[yomi])
    .mapValues(group => _.map(group, 'api_ship_id'))
    .value()
}

/**
 * Get total plane and bomber counts from stage1 and stage2.
 */
const getPlaneCounts = (data = {}) => {
  const planes = data.api_stage1?.api_e_count || 0
  const lost = data.api_stage1?.api_e_lostcount || 0
  const bombers = data.api_stage2?.api_e_count || 0
  return (
    planes && {
      planes,
      bombersMin: bombers,
      bombersMax: bombers + lost,
    }
  )
}

/**
 * Get plane counts for first air battle, if any.
 */
export const getFirstPlaneCounts = (data = {}) =>
  getPlaneCounts(data.api_air_base_injection) ||
  getPlaneCounts(data.api_injection_kouku) ||
  getPlaneCounts(data.api_air_base_attack?.[0]) ||
  getPlaneCounts(data.api_kouku)
