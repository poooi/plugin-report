import type { APIDeckPort, APIShip } from 'kcsapi/api_port/port/response'
import type { APISlotItem } from 'kcsapi/api_get_member/require_info/response'
import type { APIMstShip, APIMstSlotitem } from 'kcsapi/api_start2/getData/response'

export type WindowDeck = Pick<APIDeckPort, 'api_ship'> & Partial<APIDeckPort>
export type WindowShip = APIShip
export type WindowSlotItem = APISlotItem
export type WindowMasterShip = APIMstShip
export type WindowMasterSlotItem = APIMstSlotitem

export interface PoiWindowStoreState {
  sortie?: {
    sortieMapId?: number
  }
  battle?: unknown
  const?: {
    $ships?: Record<string | number, WindowMasterShip>
    $slotitems?: Record<string | number, WindowMasterSlotItem>
  }
  [key: string]: unknown
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  value != null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export const parseInt10 = (value: string | number | null | undefined): number =>
  parseInt(String(value), 10)

export const getWindowShip = (shipId: string | number): WindowShip | undefined =>
  window._ships[shipId]

export const getWindowSlotItem = (slotItemId: string | number): WindowSlotItem | undefined =>
  window._slotitems[slotItemId]
