# TypeScript migration plan

## Purpose

Migrate `plugin-report` from `.es` sources and `poi-util-transpile` to TypeScript following the patterns used by `poooi/plugin-anchorage-repair` and `poooi/plugin-ship-info`.

The migration should preserve runtime behavior while making reporter payloads, game API events, and Poi globals type-checkable. The plan is intentionally split into reviewable PRs so each step can pass validation independently.

## Sources and reference patterns

Verified during planning:

| Source                                                                               | Verified details used by this plan                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `poooi/plugin-anchorage-repair` at commit `fdc8f40d74a3a723e0946a6d20e438be225ca2b6` | Uses `tsdown` with `src/index.tsx` entry, CJS output to root `index.js`, `dts: false`, `clean: false`, sourcemaps, TypeScript 5.9, `typecheck`, `lint`, and `test` scripts. Uses local shims for Poi/Electron globals and Vitest for pure logic tests. |
| `poooi/plugin-ship-info` at commit `0e1eb478cd71b8b5ff743fd542228b3b1955dddc`        | Uses `tsdown` with `index-src.ts` entry, CJS output, TypeScript strict mode, `@typescript-eslint`, `kcsapi`, and shims for Poi globals/vendor modules.                                                                                                 |
| Current `plugin-report`                                                              | Uses `.es` source files, `main: "index.js"`, `prepack: "poi-util-transpile --sm"`, npm lockfile, ESLint 6 with `babel-eslint`, no real test script, and reporter classes under `reporters/`.                                                           |

Important constraints:

- Do not introduce local machine paths in docs, commits, PR bodies, generated source maps, or build metadata.
- Keep the migration behavior-safe: reporters send production data, so runtime parity matters more than type elegance.
- Migrate the project to pnpm as part of the TypeScript migration, matching the modern reference plugin direction.
- Do not mix this migration with feature changes such as item improvement v3 reporting. TypeScript migration should be a prerequisite or parallel infrastructure track, not a behavior rewrite.

## Current codebase inventory

Source files to migrate:

| Area               | Current files                                                                | Notes                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Entry/runtime      | `index.es`, `sentry.es`                                                      | Uses Poi globals, Electron remote, Sentry, and `game.response` events.                                       |
| Reporter base      | `reporters/base.es`                                                          | Defines `getJson` and `report`; wraps `node-fetch`; reads `window.SERVER_HOSTNAME` and `window.POI_VERSION`. |
| Reporters          | `reporters/*.es`                                                             | Mostly data extractors around `window` game state and Kancolle API payloads.                                 |
| Reporter utilities | `reporters/utils.es`                                                         | Contains pure helpers and global state snapshots; good first test target.                                    |
| Config             | `.eslintrc.js`, `lint-staged.config.js`, `package.json`, `package-lock.json` | Old npm/Babel/ESLint/transpile setup.                                                                        |

### Planning-stage source scan results

The `.es` source scan was performed during planning so implementation is not blocked on discovering avoidable mechanical-conversion issues later.

Scanned source files:

- `index.es`
- `sentry.es`
- `reporters/*.es`

Findings:

| Check                                          | Result                                                                                    | Required migration action                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| JSX syntax                                     | No JSX found in `.es` files.                                                              | Rename source files to `.ts`; no `.tsx` files are currently needed.                                                     |
| Decorators                                     | No decorators found.                                                                      | No decorator TypeScript config needed.                                                                                  |
| Extensionful `.es` imports                     | None found.                                                                               | Keep imports extensionless.                                                                                             |
| Non-code imports (`json`, css, images, stylus) | None found.                                                                               | No `resolveJsonModule` or asset module shims needed for current source.                                                 |
| Babel `export X from` proposal syntax          | Found in `reporters/index.es`.                                                            | Convert to standard `export { default as X } from './x'`. Preserve exported names, including `NightContactReportor`.    |
| Runtime aliases                                | `views/utils/selectors` imports and `views/utils/aaci` require found in battle reporters. | Keep `views/*` external in `tsdown`, add ambient shims, and stub these aliases in smoke tests.                          |
| Relative package metadata require              | `reporters/base.es` uses `require('../package.json')`.                                    | After moving to `src/reporters/base.ts`, change to `require('../../package.json')`.                                     |
| Dynamic require                                | No variable dynamic require found; `require` calls use string literals.                   | Stub string-literal runtime requires in smoke tests.                                                                    |
| Class fields / optional chaining               | Present.                                                                                  | TypeScript target/config must parse class fields and optional chaining; `target: "es2018"` with `tsdown` is acceptable. |

Notable runtime dependencies currently used but not declared as runtime dependencies:

- `@electron/remote`
- `@sentry/electron`
- `lodash`
- `moment-timezone`
- `node-fetch`
- `semver`
- `views/utils/selectors`
- `views/utils/aaci`

These are likely provided by Poi/plugin runtime today. The migration should mark them as `tsdown` externals and add type dependencies only as needed; do not bundle Poi runtime packages into the plugin.

## Target architecture

### Build

Use `tsdown` as in the reference plugins, but start more conservatively than the UI-heavy references to preserve reporter runtime behavior:

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: '.',
  outExtensions: () => ({ js: '.js' }),
  format: ['cjs'],
  external: [
    '@electron/remote',
    '@sentry/electron',
    'electron',
    'lodash',
    'moment-timezone',
    'node-fetch',
    'semver',
    /^views\//,
  ],
  dts: false,
  clean: false,
  sourcemap: false,
  treeshake: false,
  minify: false,
  shims: false,
  target: 'es2018',
})
```

Keep `main: "index.js"` and generate root `index.js` from `src/index.ts`. Follow the reference plugin packaging model: do not commit generated output, do not add `prepare`, and rely on `prepack` for package tarball generation. Direct install from a git checkout is not a supported release path for this migration unless a later requirement says otherwise. Validate `pnpm pack --dry-run` before merging the build-switch PR.

Do not publish source maps in the initial migration. They can be re-enabled later only after an explicit map audit proves they do not contain local absolute paths, usernames, local repository paths, or sensitive `sourcesContent`.

### Source layout

Move source to `src/`:

```text
src/
  index.ts
  sentry.ts
  reporters/
    base.ts
    index.ts
    ...
  types/
    game-api.ts
    poi-globals.d.ts
    reporter.ts
```

This follows the `plugin-anchorage-repair` style more closely and makes generated root artifacts easier to distinguish from source.

### Type strategy

Use a staged type-safety target:

1. Initial build migration: `strict: false`, `allowJs: false`, all source renamed to `.ts`, explicit `unknown`/`any` allowed only at Poi boundary types.
2. Reporter model pass: add shared event, reporter, and payload types; reduce `any`.
3. Final strict pass: enable `strict: true` and fix remaining issues.

Reason: trying to rename, bundle, type Poi globals, and enable strict mode in one PR would make review and rollback too risky.

### Test strategy

Adopt `vitest` for pure helper/state-machine tests, following `plugin-anchorage-repair`.

Initial test targets:

- `getNightBattleSSCIType`
- `getNightBattleDDCIType`
- `getNightBattleCVCIType`
- `getFirstPlaneCounts`
- future reporter normalization helpers

Reporter integration tests should mock `window`, `fetch`, and Sentry only after the build migration is stable.

## Detailed PR plan

### PR 1: TypeScript toolchain scaffolding

Goal: add TypeScript tooling without changing runtime output.

Files:

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `src/types/poi-globals.d.ts`
- optionally `src/types/vendor.d.ts`
- `docs/typescript-migration-plan.md`

Changes:

1. Migrate package manager metadata:
   - add `"packageManager": "pnpm@10.28.0"`
   - remove `package-lock.json`
   - add `pnpm-lock.yaml`
   - optionally add `pnpm-workspace.yaml` if needed by pnpm tooling, matching `plugin-anchorage-repair`
   - document Corepack/pnpm usage in the PR body
2. Add dev dependencies:
   - `typescript`
   - `@types/lodash`
   - `@types/node`
   - `@types/semver`
   - `@types/node-fetch@2` if staying on `node-fetch@2` typings
3. Add `typecheck` script: `tsc --noEmit`.
4. Do not add `@typescript-eslint/*` in this PR; lint integration is handled in PR 6 with a compatible ESLint/version set.
5. Keep `prepack: "poi-util-transpile --sm"` unchanged in this PR.
6. Add `src/types/vendor.d.ts` for runtime modules that are provided by Poi or current runtime but may not have project-local typings:
   - `@electron/remote`
   - `@sentry/electron`
   - `electron`
   - `views/utils/selectors`
   - `views/utils/aaci`
7. Add `tsconfig.json` with a permissive first target:

```json
{
  "compilerOptions": {
    "target": "es2018",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "strict": false,
    "baseUrl": ".",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"],
  "exclude": ["node_modules"]
}
```

8. Add Poi/global declarations with minimal, explicitly unsafe boundaries:
   - `window.POI_VERSION`
   - `window.LATEST_COMMIT`
   - `window.ROOT`
   - `window.APPDATA_PATH`
   - `window.SERVER_HOSTNAME`
   - `window._decks`, `window._ships`, `window._slotitems`, `window._teitokuLv`, etc.
   - global `config`

Validation:

- `corepack enable` if pnpm is not already available
- one non-frozen `pnpm install` to generate `pnpm-lock.yaml`
- `pnpm install --frozen-lockfile`
- `pnpm run typecheck`
- existing `pnpm run prepack`

Acceptance criteria:

- Runtime source and generated output are unchanged.
- TypeScript can run against declarations only; this PR is not expected to type-check existing `.es` source yet.
- The repo uses pnpm lockfile and `packageManager`; npm lockfile is removed.
- No ESLint dependency changes.

Risks:

- Type package versions may still reveal missing runtime module declarations. Prefer local ambient declarations over adding runtime packages that should remain external.

### PR 2: Verify source preflight findings and add runtime smoke harness

Goal: verify the planning-stage source scan against the latest branch state and add the smoke harness before changing runtime output.

Files:

- `scripts/smoke-load.cjs`
- `docs/typescript-migration-plan.md` if new findings appear

Changes:

1. Re-run the planning-stage source scan and update the findings table only if source changed since this plan.
2. Confirm these known non-mechanical conversion actions are still required and remain covered by PR 3:
   - standardize `reporters/index` exports
   - preserve `views/*` aliases as externals/shims/stubs
   - update the moved `package.json` require path
3. Add a smoke-load script that can load the built plugin in a mocked Poi/Electron environment after the build switch:
   - defines required `window` and `global` fields
   - stubs `window.addEventListener` / `removeEventListener`
   - stubs `@electron/remote.require('./lib/game-api-broadcaster')`
   - stubs or verifies Sentry import behavior
   - stubs Poi `views/*` module aliases used by reporters
   - verifies `pluginDidLoad` registers the `game.response` listener and `pluginWillUnload` removes it
   - stubs `node-fetch` and exercises `BaseReporter.getJson` or `BaseReporter.report` enough to catch CJS/default-import interop and root `package.json` version loading
4. Keep the script inactive or skipped until `index.js` exists in PR 3, but design it in this PR so validation expectations are clear.

Validation:

- `pnpm run typecheck`
- preflight search results reviewed

Acceptance criteria:

- Planning-stage scan findings are verified against current source.
- No unknown syntax/import blockers remain for the rename.
- Runtime smoke requirements are explicit before switching transpilers.

Risks:

- Mocking Electron/Poi globals can become too broad. Keep the smoke test focused on module load and listener lifecycle only.

### PR 3: Mechanical source move and tsdown build

Goal: move sources to TypeScript and switch packaging to `tsdown` with minimal behavior changes.

Files:

- `index.es` -> `src/index.ts`
- `sentry.es` -> `src/sentry.ts`
- `reporters/*.es` -> `src/reporters/*.ts`
- `tsdown.config.ts`
- `package.json`
- `pnpm-lock.yaml`
- `.gitignore`
- `.gitattributes`
- `.npmignore` or `files` in `package.json`

Changes:

1. Move source under `src/`.
2. Rename `.es` files to `.ts`.
3. Update relative imports where paths change.
4. Convert Babel proposal export syntax in `reporters/index.es`:

```ts
export { default as AACIReporter } from './aaci'
```

Keep existing exported names, including the misspelled `NightContactReportor`, to avoid behavior/API churn.

5. Update moved relative paths that depend on file depth. Known required change: `src/reporters/base.ts` must load root package metadata from `../../package.json`, not `../package.json`.
6. Add `tsdown.config.ts` based on the reference pattern.
7. Change scripts:
   - `prepack: "tsdown"`
   - `build: "tsdown"`
   - keep `postpublish` unchanged only after auditing lifecycle behavior
8. Decide packaging artifact policy:
   - add `files` to package metadata for `i18n`, `index.js`, `package.json`, `README.md`, `LICENSE`
   - exclude `src/`, `*.ts`, `*.mts`, and tool configs from the package unless needed for debugging
9. Update `.gitattributes` to include `*.ts`, `*.tsx`, and `*.mts`.
10. Update `lint-staged.config.js` to include `*.ts`.
11. Add `tsdown` as a dev dependency.
12. Audit lifecycle scripts: `prepack`, `prepare`, `postpack`, `prepublishOnly`, `postpublish`. Do not add `prepare` in this migration. Explicitly record whether keeping `postpublish: "git clean -f && git checkout ."` is still safe with generated, uncommitted `index.js`.

Validation:

- `pnpm run build`
- `pnpm run typecheck`
- `pnpm pack --dry-run`
- runtime smoke-load script from PR 2
- Compare packed files to current package expectations.

Acceptance criteria:

- `index.js` is generated by `tsdown`.
- The packed plugin contains runtime files and i18n files.
- No reporter behavior changes beyond generated syntax.
- No sourcemap is published in this PR.

Risks:

- `tsdown` may not preserve the exact module wrapper behavior from `poi-util-transpile`.
- CJS interop for external modules can differ from Babel output. The smoke script must cover imports used by `index.ts`, `sentry.ts`, and `BaseReporter`.
- Missing Poi `views/*` aliases will break bundle/smoke tests. Keep them external and stubbed.

### PR 4: Reporter and game API boundary types

Goal: introduce shared types without changing reporter behavior.

Files:

- `src/types/reporter.ts`
- `src/types/game-api.ts`
- `src/types/window-state.ts`
- `src/reporters/base.ts`
- `src/index.ts`
- reporter files as needed

Changes:

1. Define `GameResponseEventDetail`:
   - `method`
   - `path`
   - `body`
   - `postBody`
   - `time`
2. Define `Reporter` interface:

```ts
export interface Reporter {
  handle(
    method: string,
    path: string,
    body: unknown,
    postBody: Record<string, string>,
    time: number,
  ): void
}
```

3. Type `BaseReporter.report` and `BaseReporter.getJson`.
4. Add boundary helpers:
   - `asRecord`
   - `parseInt10`
   - `getWindowShip`
   - `getWindowSlotItem`
5. Keep Kancolle response bodies as `unknown` or coarse local interfaces at API boundaries until each reporter is typed.

Validation:

- `pnpm run typecheck`
- `pnpm run build`

Acceptance criteria:

- Entry and base reporter are typed.
- Reporter classes conform to a shared interface.
- No new broad catch/silent fallback behavior is introduced.

Risks:

- Over-typing early can force inaccurate assumptions about Poi's window state. Prefer narrow guards at access points.

### PR 5: Incremental reporter typing

Goal: type reporters in small, reviewable groups.

Recommended grouping:

1. Simple construction/development reporters:
   - `create-ship`
   - `create-item`
2. Data-list/reporting reporters:
   - `quest`
   - `ship-stat`
3. Battle/reporting reporters:
   - `drop-ship`
   - `enemy-info` helpers in `utils`
   - `night-contact`
   - `night-battle-ci`
   - `aaci`
4. Remodel reporters:
   - `remodel-recipe`
   - `remodel-item`

Changes:

1. Add local request/response interfaces per endpoint only for fields used.
2. Replace implicit `any` with endpoint-specific types or `unknown` plus guards.
3. Preserve current payload field names.
4. Add tests for pure utilities as they become typed.
5. Do not implement item improvement v3 collection in this PR; keep behavior unchanged.

Validation:

- `pnpm run typecheck`
- `pnpm run build`
- targeted `vitest` tests when test tooling exists

Acceptance criteria:

- Each reporter group type-checks.
- Existing report payload shapes remain compatible.
- Sentry context still avoids local path disclosure.

Risks:

- `window` state can be partially loaded. Types must not hide existing runtime null/undefined cases.

### PR 6: Test and lint modernization

Goal: bring validation closer to the reference plugins without blocking the mechanical migration.

Files:

- `package.json`
- `pnpm-lock.yaml`
- ESLint config
- `vitest.config.ts` if needed
- `src/**/*.test.ts`

Changes:

1. Add `vitest` and convert `test` script from placeholder to `vitest run`.
2. Add tests for pure utility behavior and any new normalization helpers.
3. Decide ESLint path:
   - conservative: keep ESLint 6 and `.eslintrc.js`, add TS parser/rules like `plugin-ship-info`
   - modern: upgrade to ESLint 9 flat config like `plugin-anchorage-repair`
4. Pin a compatible ESLint / `@typescript-eslint` / TypeScript version set before installing. Do not mix latest `@typescript-eslint` with ESLint 6.
5. Prefer conservative ESLint first unless the dependency tree forces a modern upgrade.
6. Update `lint-staged.config.js` for `*.{ts,tsx}`.

Validation:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`

Acceptance criteria:

- Tests run in CI/local.
- Lint covers TS files.
- No unrelated formatting churn across all files.

Risks:

- ESLint 9 migration can become a large unrelated change. Keep it as its own PR if chosen.

### PR 7: Strict mode and cleanup

Goal: finish migration and remove legacy tooling.

Files:

- `tsconfig.json`
- `package.json`
- `pnpm-lock.yaml`
- old config files if obsolete
- source files with stricter types

Changes:

1. Enable `strict: true`.
2. Fix strict errors without using blanket `any`.
3. Remove `babel-eslint` and `poi-util-transpile` if no longer used.
4. Remove `.es` handling from lint-staged and gitattributes if obsolete.
5. Confirm package contents and generated artifact policy.
6. Add a short migration note to `README.md` if contributor commands change.

Validation:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`
- `pnpm pack --dry-run`

Acceptance criteria:

- No `.es` source files remain.
- TypeScript strict mode passes.
- Build and package commands are documented.
- Runtime package contents match plugin expectations.

Risks:

- Removing old transpile tooling too early can break release flow. Only remove it after `tsdown` pack validation passes.

## Cross-cutting implementation rules

- Keep PRs behavior-preserving unless the PR explicitly says otherwise.
- Do not combine TypeScript migration with report schema or endpoint changes.
- If source maps are re-enabled later, keep generated maps free of local absolute paths and sensitive `sourcesContent`.
- Use typed wrappers at unsafe boundaries instead of spreading `any`.
- Add regression tests when migration work exposes or fixes a bug.
- Keep imports extensionless so `tsdown` and TypeScript resolve consistently.
- Use `unknown` for untrusted API bodies, then narrow.
- Keep external runtime modules external in `tsdown`; do not bundle Poi/Electron runtime modules.

## Validation matrix

| Command                          | Introduced by | Purpose                                                                                               |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PR 1          | Verifies pnpm lockfile integrity.                                                                     |
| `pnpm run typecheck`             | PR 1          | TypeScript correctness.                                                                               |
| `pnpm run build`                 | PR 3          | Generates plugin runtime output through `tsdown`.                                                     |
| smoke-load script                | PR 3          | Verifies generated `index.js` can load and register/unregister listeners in a mocked Poi environment. |
| `pnpm pack --dry-run`            | PR 3          | Verifies package contents.                                                                            |
| `pnpm test`                      | PR 6          | Runs pure helper/reporter tests.                                                                      |
| `pnpm run lint`                  | PR 6          | Lints TS source.                                                                                      |

## Rollback strategy

- PR 1 can be reverted without runtime impact.
- PR 2 is a preflight and can be reverted without runtime impact.
- PR 3 is the main release-flow switch. Keep it isolated so rollback restores `.es` + `poi-util-transpile`.
- PR 4 and PR 5 should remain behavior-preserving; if a typed reporter breaks runtime, revert the reporter group PR instead of the whole migration.
- PR 6 and PR 7 are validation/cleanup; revert independently if tooling causes contributor friction.

## Open decisions before implementation

1. Package manager: migrate to pnpm in PR 1 and keep pnpm for the rest of the migration.
2. Generated output: do not commit generated `index.js`; validate package tarball generation through `prepack`.
3. Source maps: do not publish maps in the initial migration; add a later audited PR if maps are needed.
4. ESLint modernization: keep it separate from source migration unless dependency compatibility forces it.
5. Kancolle API typing: use local minimal interfaces first, then introduce `kcsapi` types where they are stable and reduce maintenance.

## Ready-to-implement checklist

- Reference plugin patterns verified.
- PR sequence keeps runtime switch isolated.
- Package-manager choice is explicit.
- Build output and packaging validation are included.
- Strict typing is staged rather than forced in the mechanical rename.
- Behavior changes are explicitly out of scope.
