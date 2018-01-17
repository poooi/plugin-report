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
