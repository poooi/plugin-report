declare global {
  interface Window {
    POI_VERSION: string
    LATEST_COMMIT: string
    ROOT: string
    APPDATA_PATH: string
    SERVER_HOSTNAME: string
    _decks: Record<string | number, any>
    _ships: Record<string | number, any>
    $ships: Record<string | number, any>
    _slotitems: Record<string | number, any>
    _teitokuId: number
    _teitokuLv: number
    _nickName: string
    _nickNameId: string | number
    getStore(): any
  }

  const config: {
    get(key: string): any
  }
}

export {}
