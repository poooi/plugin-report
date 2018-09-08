import { createHash } from 'crypto'
import _ from 'lodash'

const hasAtLeast = num => f => xs => xs.filter(f).length >= num
const validAll = (...func) => x => func.every(f => f(x))
const validAny = (...func) => x => func.some(f => f(x))

const equipype2Is = num => equip => _.get(equip, 'api_type.2') === num
const equipIdIs = num => equip => equip.api_slotitem_id === num

export const getHpStyle = (percent) => {
  if (percent <= 25) {
    return 'red'
  } else if (percent <= 50){
    return 'orange'
  } else if (percent <= 75){
    return 'yellow'
  } else {
    return 'green'
  }
}

// T = Torpedo
// LMT = Late Model Torpedo
// R = Radar

export const getNightBattleSSCIType = (equips) => {
  if (validAll(
    hasAtLeast(1)(equipype2Is(51)),
    hasAtLeast(1)(
      validAny(
        equipIdIs(213),
        equipIdIs(214),
      )
    ))(equips))
    {
    return 'SS_LMT_R'
  }
  if (hasAtLeast(2)(
    validAny(
      equipIdIs(213),
      equipIdIs(214),
    ))(equips))
    {
    return 'SS_LMT_LMT'
  }
  if (validAny(
    hasAtLeast(1)(equipype2Is(51)),
    hasAtLeast(1)(
      validAny(
        equipIdIs(213),
        equipIdIs(214),
      )
  ))(equips))
    {
    return 'SS_T_T'
  }

  return ''
}

const houmAboveOrEqual = num => equip => equip.api_houm >= num

// G_T_R = Gun Torpedo Radar
// T_R_P = Torpedo Radar Personnel
export const getNightBattleDDCIType = (equips) => {
  if (validAll(
    hasAtLeast(1)(equipype2Is(1)),
    hasAtLeast(1)(equipype2Is(5)),
    hasAtLeast(1)(validAll(
      validAny(
        equipype2Is(12),
        equipype2Is(13),
      ),
      houmAboveOrEqual(3)
    ))
  )(equips)) {
    return 'DD_G_T_R'
  }

  if (validAll(
    hasAtLeast(1)(equipype2Is(5)),
    hasAtLeast(1)(equipIdIs(129)),
    hasAtLeast(1)(validAll(
      validAny(
        equipype2Is(12),
        equipype2Is(13),
      ),
      houmAboveOrEqual(3),
    )),
  )(equips)) {
    return 'DD_T_R_P'
  }

  return ''
}

let teitokuId = window._teitokuId
let teitokuHash = null

export const getTeitokuHash = () => {
  const { _teitokuId, _nickName, _nickNameId } = window
  if ((teitokuId !== _teitokuId || !teitokuHash)
      && _teitokuId !== -1 && _nickName && _nickNameId !== -1) {
    teitokuId = _teitokuId
    teitokuHash = createHash('sha1')
      .update(`${_teitokuId}_${_nickName}_${_nickNameId}`)
      .digest('base64')
  }
  return teitokuHash
}

/**
 * Count all owned remodels of a given ship.
 *
 * E.g., having 2 Taigei and 1 Ryuuhou Kai will return [2, 0, 1].
 *
 * Returns [] if none of the forms are owned.
 */
export const countOwnedShips = (baseId) => {
  const $ships = window.$ships || {}
  const _ships = window._ships || {}
  let current = $ships[baseId]
  let nextId = +(current.api_aftershipid || 0)
  let ids = [baseId]
  let cutoff = 10
  while (!ids.includes(nextId) && nextId > 0 && cutoff > 0) {
    ids = [...ids, nextId]
    current = $ships[nextId] || {}
    nextId = +(current.api_aftershipid || 0)
    --cutoff
  }
  const counts = ids.map(api_ship_id => _.filter(_ships, { api_ship_id }).length)
  return _.dropRightWhile(counts, e => !e)
}
