declare module '@electron/remote' {
  export function require(id: string): any
}

declare module '@sentry/electron' {
  export function captureException(error: unknown, context?: Record<string, any>): void
  export function configureScope(callback: (scope: any) => void): void
  export function init(options: Record<string, any>): void
  export function setContext(name: string, context: any): void
  export function withScope(callback: (scope: any) => void): void
}

declare module 'electron' {
  const electron: any
  export = electron
}

declare module 'views/utils/selectors' {
  export function shipDataSelectorFactory(shipId: unknown): (state: unknown) => any
  export function shipEquipDataSelectorFactory(shipId: unknown): (state: unknown) => any
}

declare module 'views/utils/aaci' {
  export function getShipAACIs(ship: unknown, equips: unknown): any
}
