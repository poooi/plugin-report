import type {
  PoiWindowStoreState,
  WindowDeck,
  WindowMasterShip,
  WindowShip,
  WindowSlotItem,
} from './window-state'

declare global {
  interface Window {
    POI_VERSION: string
    LATEST_COMMIT: string
    ROOT: string
    APPDATA_PATH: string
    SERVER_HOSTNAME: string
    _decks: Record<string | number, WindowDeck | undefined>
    _ships: Record<string | number, WindowShip | undefined>
    $ships: Record<string | number, WindowMasterShip | undefined>
    _slotitems: Record<string | number, WindowSlotItem | undefined>
    _teitokuId: number
    _teitokuLv: number
    _nickName: string
    _nickNameId: string | number
    getStore(): PoiWindowStoreState
  }

  const config: {
    get<T = unknown>(key: string): T
  }
}

export {}
