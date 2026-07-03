export type GameApiMethod = string
export type GameApiPath = string
export type GameApiPostBody = Record<string, string | undefined>
export type GameApiResponseBody = unknown

export interface GameResponseEventDetail {
  method: GameApiMethod
  path: GameApiPath
  body: GameApiResponseBody
  postBody: GameApiPostBody
  time: number
}

export type GameResponseEvent = CustomEvent<GameResponseEventDetail>
