# plugin-report

Report ship creating info and drop info, and so on.

## Development

- `pnpm run lint` checks JavaScript and TypeScript sources.
- `pnpm run typecheck` runs TypeScript in strict mode.
- `pnpm run storybook` previews React plugin UI surfaces.
- `pnpm test` builds the plugin and runs the Vitest suite.

## Remodel debug recorder

For local remodel recipe validation, the plugin includes an opt-in in-memory recorder. It is off by default and only records the three Akashi remodel APIs.

Enable it from the plugin settings panel. The settings panel also shows the in-memory record count and provides `Export` and `Clear` actions.

Captures stay in memory and are not sent anywhere; allowlisted, sanitized data is written only when `Export` is clicked. Disable the setting after collecting the local validation data.
