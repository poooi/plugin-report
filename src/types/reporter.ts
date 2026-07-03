import type { GameApiMethod, GameApiPath, GameApiPostBody, GameApiResponseBody } from './game-api'

export interface Reporter {
  handle(
    method: GameApiMethod,
    path: GameApiPath,
    body: GameApiResponseBody,
    postBody: GameApiPostBody,
    time: number,
  ): void
}

export type ReportPayload = unknown
