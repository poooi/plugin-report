# plugin-report

Report ship creating info and drop info, and so on.

## Development

- `pnpm run lint` checks JavaScript and TypeScript sources.
- `pnpm run typecheck` runs TypeScript in strict mode.
- `pnpm test` builds the plugin and runs the Vitest suite.

## Remodel debug recorder

For local remodel recipe validation, the plugin includes an opt-in in-memory recorder. It is off by default and only records the three Akashi remodel APIs.

Enable it from the Poi devtools console, then reload the plugin:

```js
localStorage.setItem('poi-plugin-report:remodel-debug-recorder', '1')
```

When enabled, a small local control appears with `Export` and `Clear`. Captures stay in memory and are not sent anywhere; allowlisted, sanitized data is written only when `Export` is clicked.

Disable it with:

```js
localStorage.removeItem('poi-plugin-report:remodel-debug-recorder')
```
