import { beforeAll, describe, expect, it } from 'vitest'
import type * as ReporterUtils from '../src/reporters/utils'

let getFirstPlaneCounts: typeof ReporterUtils.getFirstPlaneCounts
let getHpStyle: typeof ReporterUtils.getHpStyle
let getNightBattleCVCIType: typeof ReporterUtils.getNightBattleCVCIType
let getNightBattleDDCIType: typeof ReporterUtils.getNightBattleDDCIType
let getNightBattleSSCIType: typeof ReporterUtils.getNightBattleSSCIType

beforeAll(async () => {
  globalThis.window = {
    _teitokuId: 1,
    _ships: {},
    $ships: {},
  } as unknown as Window & typeof globalThis
  ;({
    getFirstPlaneCounts,
    getHpStyle,
    getNightBattleCVCIType,
    getNightBattleDDCIType,
    getNightBattleSSCIType,
  } = await import('../src/reporters/utils'))
})

const equip = ({ id = 0, type2 = 0, type3 = 0, houm = 0 } = {}) => ({
  api_slotitem_id: id,
  api_type: [0, 0, type2, type3],
  api_houm: houm,
})

describe('reporter utility helpers', () => {
  describe('getHpStyle', () => {
    it('classifies HP percentage thresholds', () => {
      expect(getHpStyle(25)).toBe('red')
      expect(getHpStyle(50)).toBe('orange')
      expect(getHpStyle(75)).toBe('yellow')
      expect(getHpStyle(76)).toBe('green')
    })
  })

  describe('getNightBattleSSCIType', () => {
    it('detects submarine cut-in equipment patterns by priority', () => {
      expect(getNightBattleSSCIType([equip({ type2: 51 }), equip({ id: 213 })])).toBe('SS_LMT_R')
      expect(getNightBattleSSCIType([equip({ id: 213 }), equip({ id: 214 })])).toBe('SS_LMT_LMT')
      expect(getNightBattleSSCIType([equip({ type2: 51 })])).toBe('SS_T_T')
      expect(getNightBattleSSCIType([])).toBe('')
    })
  })

  describe('getNightBattleDDCIType', () => {
    it('detects destroyer cut-in equipment patterns', () => {
      const radar = equip({ type2: 12, houm: 3 })

      expect(getNightBattleDDCIType([equip({ type2: 1 }), equip({ type2: 5 }), radar])).toBe(
        'DD_G_T_R',
      )
      expect(getNightBattleDDCIType([equip({ type2: 5 }), equip({ id: 129 }), radar])).toBe(
        'DD_T_R_P',
      )
      expect(
        getNightBattleDDCIType([
          equip({ type2: 1 }),
          equip({ type2: 5 }),
          equip({ type2: 12, houm: 2 }),
        ]),
      ).toBe('')
    })
  })

  describe('getNightBattleCVCIType', () => {
    it('detects carrier cut-in equipment patterns by priority', () => {
      const nightFighter = equip({ type3: 45 })
      const nightBomber = equip({ type3: 46 })
      const swordfish = equip({ id: 154 })
      const suisei = equip({ id: 320 })

      expect(getNightBattleCVCIType([nightFighter, nightFighter, nightBomber])).toBe('CV_NF_NF_NB')
      expect(getNightBattleCVCIType([nightFighter, nightFighter, nightFighter])).toBe('CV_NF_NF_NF')
      expect(getNightBattleCVCIType([nightFighter, nightBomber, swordfish])).toBe('CV_NF_NB_B')
      expect(getNightBattleCVCIType([nightFighter, nightFighter, swordfish])).toBe('CV_NF_NF_B')
      expect(getNightBattleCVCIType([nightFighter, swordfish, equip({ id: 242 })])).toBe(
        'CV_NF_B_B',
      )
      expect(getNightBattleCVCIType([nightFighter, swordfish, suisei])).toBe('CV_NF_B_S')
      expect(getNightBattleCVCIType([nightFighter, nightBomber])).toBe('CV_NF_NB')
      expect(getNightBattleCVCIType([nightBomber, suisei])).toBe('CV_NB_S')
      expect(getNightBattleCVCIType([nightFighter, suisei])).toBe('CV_NF_S')
      expect(getNightBattleCVCIType([])).toBe('')
    })
  })

  describe('getFirstPlaneCounts', () => {
    it('returns first available air battle plane counts in source priority order', () => {
      const airBaseInjection = {
        api_stage1: { api_e_count: 10, api_e_lostcount: 2 },
        api_stage2: { api_e_count: 3 },
      }
      const kouku = {
        api_stage1: { api_e_count: 20, api_e_lostcount: 4 },
        api_stage2: { api_e_count: 5 },
      }

      expect(
        getFirstPlaneCounts({
          api_air_base_injection: airBaseInjection,
          api_kouku: kouku,
        }),
      ).toEqual({
        planes: 10,
        bombersMin: 3,
        bombersMax: 5,
      })
      expect(getFirstPlaneCounts({ api_kouku: kouku })).toEqual({
        planes: 20,
        bombersMin: 5,
        bombersMax: 9,
      })
      expect(getFirstPlaneCounts({ api_kouku: { api_stage1: { api_e_count: 0 } } })).toBe(0)
    })
  })
})
