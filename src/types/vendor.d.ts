declare module '@electron/remote' {
  export function require<T = unknown>(id: string): T
}

declare module '@sentry/electron' {
  export interface Scope {
    setTag(key: string, value: string): void
    setTags(tags: Record<string, string>): void
  }

  export function captureException(error: unknown, context?: Record<string, unknown>): void
  export function configureScope(callback: (scope: Scope) => void): void
  export function init(options: Record<string, unknown>): void
  export function setContext(name: string, context: unknown): void
  export function withScope(callback: (scope: Scope) => void): void
}

declare module 'electron' {
  const electron: any
  export = electron
}

declare module 'moment-timezone' {
  interface Moment {
    day(): number
    format(format?: string): string
    hour(): number
    tz(timezone: string): Moment
  }

  interface MomentStatic {
    (): Moment
    tz(timezone: string): Moment
    utc(): Moment
  }

  const moment: MomentStatic
  export default moment
}

declare module 'views/utils/selectors' {
  export function shipDataSelectorFactory(shipId: unknown): (state: unknown) => unknown
  export function shipEquipDataSelectorFactory(shipId: unknown): (state: unknown) => unknown
}

declare module 'views/utils/aaci' {
  export function getShipAACIs(ship: unknown, equips: unknown): number[]
}
