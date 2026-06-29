# Item improvement recipe collection plan

## Purpose

Build a reliable item improvement recipe dataset from client observations. The dataset should eventually power a UI where users can answer questions such as:

- What equipment can be improved on a given JST weekday?
- Which helper ship is required?
- What does each star range cost?
- What equipment or special items are consumed?
- What can the equipment update into?

Success-rate estimation is out of scope. The collection should focus on recipe availability, costs, helper/day conditions, star-level ranges, and update paths.

## Sources and verification

This design must stay tied to actively maintained gameplay documentation and current API definitions. Before implementation, re-check the source freshness and update this section if any field or mechanic has changed.

Verified on 2026-06-30 using the local proxy `127.0.0.1:1080` where needed.

| Source                                                                                                                                                                                             | Verification status                                                                                                                                                                                          | Used for                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [艦これ攻略 Wiki\* - 改修工廠](https://wikiwiki.jp/kancolle/%E6%94%B9%E4%BF%AE%E5%B7%A5%E5%BB%A0)                                                                                                  | Directly fetched; page reported `Last-modified: 2026-05-30 (土) 09:45:52`.                                                                                                                                   | Core mechanics: Akashi/Akashi Kai requirement, helper/day dependency, JST menu refresh, consumption behavior, update behavior.                                   |
| [艦これ攻略 Wiki\* - 改修表](https://wikiwiki.jp/kancolle/%E6%94%B9%E4%BF%AE%E8%A1%A8)                                                                                                             | Directly fetched; page reported `Last-modified: 2026-06-29 (月) 06:37:20`.                                                                                                                                   | Recipe dimensions needed by the final UI: equipment, helper ship, weekday, star bracket, resource costs, required equipment/items, update target.                |
| [English KanColle Wiki - Akashi's Improvement Arsenal](https://en.kancollewiki.net/Akashi%27s_Improvement_Arsenal) and [Helper](https://en.kancollewiki.net/Akashi%27s_Improvement_Arsenal/Helper) | Direct fetch returned HTTP 403 during this planning session. Treat as a cross-language terminology/reference source only after manual verification; do not use as the sole source of truth for field design. | English naming/terminology and UI wording cross-check.                                                                                                           |
| [KanColle Fandom - Akashi's Improvement Arsenal](https://kancolle.fandom.com/wiki/Akashi%27s_Improvement_Arsenal)                                                                                  | API metadata fetched; latest revision timestamp was `2020-04-03T14:10:14Z`, so it is not treated as an actively maintained source for current recipe mechanics.                                              | Historical/terminology reference only, not authoritative.                                                                                                        |
| [`KagamiChan/kcsapi.ts` - `api_req_kousyou/remodel_slotlist/response.ts`](https://github.com/KagamiChan/kcsapi.ts/blob/master/api_req_kousyou/remodel_slotlist/response.ts)                        | Directly fetched from GitHub; blob SHA observed as `f52fbbe6b44f4c220f13fab2efe6ed7c9e1124dd`.                                                                                                               | Current typed fields for `remodel_slotlist`.                                                                                                                     |
| [`KagamiChan/kcsapi.ts` - `api_req_kousyou/remodel_slotlist_detail/response.ts`](https://github.com/KagamiChan/kcsapi.ts/blob/master/api_req_kousyou/remodel_slotlist_detail/response.ts)          | Directly fetched from GitHub; blob SHA observed as `0f38b8681fdf04b3f9393c01758e7ff0e453d09c`.                                                                                                               | Current typed fields for `remodel_slotlist_detail`, including special item fields.                                                                               |
| [`KagamiChan/kcsapi.ts` - `api_req_kousyou/remodel_slot/response.ts`](https://github.com/KagamiChan/kcsapi.ts/blob/master/api_req_kousyou/remodel_slot/response.ts)                                | Directly fetched from GitHub; blob SHA observed as `f80849758783bdcc6699c70c5213a847dcdb25ce`.                                                                                                               | Current typed fields for `remodel_slot`, including update-result fields.                                                                                         |
| [`KC3Kai/KC3Kai` - `src/library/modules/Kcsapi.js`](https://github.com/KC3Kai/KC3Kai/blob/master/src/library/modules/Kcsapi.js)                                                                    | Directly inspected from GitHub at commit `27208e9b0f22fa6e3d98bd61c1873e97a85a5faa`.                                                                                                                         | Cross-check that actively used clients handle optional detail fields such as `api_req_useitem_id2` and optional secondary required equipment fields defensively. |

Implementation rule: if the Japanese wiki pages or API definition files have changed since the verification above, re-validate the payload fields and canonical database dimensions before writing code. If the actively maintained English wiki cannot be verified due access restrictions, document that limitation and do not block ingestion design on unverified English content.

## Repositories involved

| Repository       | Role                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `plugin-report`  | Observe Kancolle API responses in the client and report normalized recipe observations.                              |
| `poi-server`     | Receive reports, lightly normalize/deduplicate, store raw/fact data, and expose export endpoints.                    |
| External builder | Pull exported data from `poi-server`, resolve conflicts, merge star ranges, and build the canonical recipe database. |
| UI/API service   | Serve user-facing recipe lookup from the canonical database. This does not need to be `poi-server`.                  |

## Current state

`plugin-report` already has `RemodelRecipeReporter` in `reporters/remodel-recipe.es`, and it is registered from `index.es`.

Current behavior:

1. Caches `/kcsapi/api_req_kousyou/remodel_slotlist`.
2. Caches `/kcsapi/api_req_kousyou/remodel_slotlist_detail`.
3. Reports `/api/report/v2/remodel_recipe` only after `/kcsapi/api_req_kousyou/remodel_slot` succeeds.

Current limitations:

- Detail data is not reported if the user only opens the confirmation screen and cancels.
- Failed execution is ignored, even though the recipe/cost was valid.
- Only coarse `stage` is stored, not exact item star level.
- Optional special item fields are not reported.
- Optional secondary required-equipment fields are not reported.
- Update targets are only known after successful execution.
- The backend `RecipeRecord` stores the old coarse shape and is not enough for a future UI-grade recipe database.

## Kancolle API surface

There is no global API that returns all possible item improvement recipes. The client can only observe the current menu and selected recipe details.

### `/kcsapi/api_req_kousyou/remodel_slotlist`

Called when the Akashi improvement list is shown.

Useful fields from each row:

| Field                                  | Meaning                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `api_id`                               | Recipe ID.                                                               |
| `api_slot_id`                          | Equipment master ID for the improvable item.                             |
| `api_req_fuel`                         | Fuel cost.                                                               |
| `api_req_bull`                         | Ammo cost.                                                               |
| `api_req_steel`                        | Steel cost.                                                              |
| `api_req_bauxite`                      | Bauxite cost.                                                            |
| `api_req_buildkit`                     | May be present; detail API is more authoritative for exact star level.   |
| `api_req_remodelkit`                   | May be present; detail API is more authoritative for exact star level.   |
| `api_req_slot_id` / `api_req_slot_num` | May be present for required equipment; detail API is more authoritative. |
| `api_sp_type`                          | Special category/type when present.                                      |

What this proves:

- The item is visible for the current helper/day/player inventory state.
- It can provide availability observations even when the user does not inspect or execute a recipe.

What this does not prove:

- Exact star-level costs.
- Required special items.
- Update target.

### `/kcsapi/api_req_kousyou/remodel_slotlist_detail`

Called when the user opens the confirmation/details screen for one recipe.

Request fields:

| Field         | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `api_id`      | Recipe ID selected from the list.                              |
| `api_slot_id` | Roster slot item ID for the specific equipment being improved. |

Response fields:

| Field                                          | Meaning                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api_req_buildkit`                             | Normal development material cost.                                                                                |
| `api_req_remodelkit`                           | Normal improvement material/screw cost.                                                                          |
| `api_certain_buildkit`                         | Guaranteed improvement development material cost.                                                                |
| `api_certain_remodelkit`                       | Guaranteed improvement screw cost.                                                                               |
| `api_req_slot_id` / `api_req_slot_num`         | Required equipment master ID/count.                                                                              |
| `api_req_slot_id2` / `api_req_slot_num2`       | Optional second required equipment master ID/count. Other clients handle these fields; collect them defensively. |
| `api_req_useitem_id` / `api_req_useitem_num`   | Required special item ID/count.                                                                                  |
| `api_req_useitem_id2` / `api_req_useitem_num2` | Optional second required special item ID/count.                                                                  |
| `api_change_flag`                              | Indicates an update/conversion path when present.                                                                |

What this proves:

- Exact costs and required materials for the selected item at its current star level.
- The current helper/day/item combination is a valid recipe.

This should be reported immediately, even if the user cancels and never executes the improvement.

### `/kcsapi/api_req_kousyou/remodel_slot`

Called only when the user executes the improvement.

Useful response fields:

| Field               | Meaning                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api_remodel_flag`  | Success flag. Do not use for success-rate collection; only use to know whether after-slot fields are meaningful. |
| `api_remodel_id`    | `[beforeItemId, afterItemId]`.                                                                                   |
| `api_after_slot`    | Result slot item when successful; includes `api_slotitem_id`, `api_level`, and optional `api_alv`.               |
| `api_use_slot_id`   | Consumed roster slot IDs when present.                                                                           |
| `api_voice_ship_id` | Helper voice ship ID; useful but not always the exact helper remodel form.                                       |

What this adds:

- Update target item ID and resulting star level when execution succeeds.
- Confirmation that a recipe can update into another item.

What this should not be required for:

- Reporting basic recipe existence or exact costs.

## Client data collection design

### Terminology: observed second ship vs required helper

Do not treat the first fleet second ship observed in the client as the recipe's required helper.

- `observedSecondShipId`: the ship master ID currently in first fleet slot 2 when the list/detail/execution API is observed; `0` means there was confirmed no second ship.
- `observedFlagshipId`: the first fleet flagship master ID observed with the API call.
- `requiredHelperId`: the helper ship requirement inferred later by the canonical builder or manual/wiki confirmation.

The ingestion layer must store `observedSecondShipId`, not `requiredHelperId`. A default Akashi recipe can appear while an unrelated second ship is present, so writing that ship as the required helper would poison UI lookup data. The canonical builder derives `requiredHelperId` only after comparing observations across second-ship contexts or applying trusted/manual source data.

The client must only send `observedSecondShipId: 0` after it successfully reads first-fleet context and confirms slot 2 is empty. If fleet context cannot be read, skip or quarantine the observation instead of falling back to `0`.

`observedFlagshipId` is provenance/diagnostic data, not a recipe key dimension for this plan. The UI assumes Akashi or Akashi Kai is required to enter the arsenal. Since recipe availability differences by Akashi form are not part of the verified recipe dimensions, the backend should preserve observed flagship IDs as an array for audit but must not use last-write-wins storage for a single flagship ID. If future verified sources show Akashi-form-specific recipes, introduce a new schema version and key dimension.

### Reporter strategy

Keep the existing v2 reporter path during migration, but add a v3 path with richer recipe observations.

Recommended implementation:

1. Keep `RemodelRecipeReporter` for `/api/report/v2/remodel_recipe`.
2. Add a new reporter or extend the existing reporter to emit `/api/report/v3/item_improvement_recipe`.
3. Prefer a separate `ItemImprovementRecipeReporter` if the code gets hard to reason about; otherwise keep one class with v2 and v3 methods.
4. Do not re-enable the old `RemodelItemReporter` as-is. It was stopped in 2016 and collects attempt/success-rate-shaped data, which is not the goal.

### Event handling

Use the existing reporter API: `handle(method, path, body, postBody, time)`.

#### On `remodel_slotlist`

1. Cache rows by `api_id`.
2. Capture current context:
   - `observedAt`: `time`
   - `day`: JST weekday based on Akashi menu refresh, using the event timestamp
   - `observedSecondShipId`: first fleet second ship master ID, or `0` if no second ship is present
   - `observedFlagshipId`: first fleet flagship master ID
3. Report list observations in batch if payload size is acceptable.
4. Mark these records as `source: "list"` and `detailObserved: false`.

List observations should be availability-only facts:

```json
{
  "schemaVersion": 1,
  "source": "list",
  "recipeId": 123,
  "itemId": 456,
  "day": 1,
  "observedSecondShipId": 789,
  "observedFlagshipId": 182,
  "detailObserved": false
}
```

#### On `remodel_slotlist_detail`

1. Find the cached list row by `postBody.api_id`.
2. Read the specific slot item from `window._slotitems[postBody.api_slot_id]`.
3. Capture exact `itemLevel`.
4. Compute `stage` for old compatibility:
   - `0`: stars 0-5
   - `1`: stars 6-9
   - `2`: stars 10 or `api_change_flag`
5. Normalize required equipment and special items into arrays.
6. Report immediately with `source: "detail"` and `detailObserved: true`.
7. Cache this detail record in a single `this.currentDetail` value with local-only `recipeId` and `slotId` so execution can enrich it later.

Only one Akashi detail confirmation can be active at a time, and there is no API call for cancel/close. Do not use an unbounded dictionary keyed by slot ID; overwrite `this.currentDetail` on every new detail event and clear it after a matching execution or on mismatched execution.

Evaluate `day`, `observedSecondShipId`, and `observedFlagshipId` at the time of the detail event. Do not blindly reuse context from the list event, because the user may leave the menu open across JST midnight or change fleet state before selecting a detail. The external builder can treat near-midnight day mismatches as uncertain if server receive time disagrees with client-computed JST day.

Detail observation shape:

```json
{
  "schemaVersion": 1,
  "source": "detail",
  "recipeId": 123,
  "itemId": 456,
  "itemLevel": 6,
  "stage": 1,
  "day": 1,
  "observedSecondShipId": 789,
  "observedFlagshipId": 182,
  "fuel": 10,
  "ammo": 20,
  "steel": 30,
  "bauxite": 40,
  "buildkit": 5,
  "remodelkit": 3,
  "certainBuildkit": 8,
  "certainRemodelkit": 5,
  "reqSlotItems": [{ "id": 456, "count": 2 }],
  "reqUseItems": [{ "id": 65, "count": 1 }],
  "changeFlag": 0,
  "detailObserved": true
}
```

#### On `remodel_slot`

1. Match cached detail by `recipeId` and local-only `slotId`.
2. If successful, `api_after_slot` exists, and the item actually converts (`api_remodel_id[0] !== api_remodel_id[1]` or `api_after_slot.api_slotitem_id !== itemId`):
   - set `source: "execution"`
   - set `upgradeObserved: true`
   - set `upgradeToItemId`
   - set `upgradeToItemLevel`
   - use `upgradeTo*` naming consistently; do not introduce separate `afterItem*` fields unless a later schema explicitly needs them
3. Report this conversion as an `ItemImprovementRecipeUpdateFact`.
4. Do not send v3 execution records for normal successful star increments; those do not add recipe information needed by the UI.
5. Reuse the matched detail observation's `day`, `observedSecondShipId`, `observedFlagshipId`, `itemId`, and `itemLevel` for the update fact so the builder can join update facts to cost facts consistently.
6. Reset only the matched cached detail; keep the current list cache if the game returns to the improvement list.
7. Do not send the roster `slotId` to the backend; it is only a local correlation key.

### Normalization helpers

Add small helpers near the reporter or in `reporters/utils.es`:

```js
const normalizeRequiredPairs = (...pairs) => {
  const counts = {}

  for (const { id, count, present } of pairs) {
    if (!present || (id === 0 && count === 0)) {
      continue
    }
    if (!(id > 0 && count > 0)) {
      throw new Error(`Invalid required item pair: ${id}/${count}`)
    }
    counts[id] = (counts[id] || 0) + count
  }

  return Object.keys(counts)
    .map(id => ({ id: parseInt(id, 10), count: counts[id] }))
    .sort((a, b) => a.id - b.id)
}
```

Callers must set `present` based on whether the API field existed. This preserves the distinction between absent/zero fields and malformed non-empty required-item fields. Do not filter malformed pairs away silently.

Recommended helpers:

- `parseInt10(value, fallback)`; do not use `0` as a fallback for context fields where `0` has semantic meaning
- `getJstDay(time)`
- `getFirstFleetShip(position)`, returning an explicit tri-state such as `{ known: true, id }` or `{ known: false }`
- `getSlotItem(slotId)`
- `getStage(itemLevel, changeFlag)`
- `normalizeReqSlotItems(body)`
- `normalizeReqUseItems(body)`

### JST day calculation

The improvement menu changes at JST midnight. The current reporter uses UTC hour >= 15 to move to the next UTC day. Keep that logic, but base it on the event timestamp instead of `moment.utc()` at report handling time.

```js
const getJstDay = (time = Date.now()) => {
  const date = new Date(time)
  const utcDay = date.getUTCDay()
  const utcHour = date.getUTCHours()
  return utcHour >= 15 ? (utcDay + 1) % 7 : utcDay
}
```

Client-computed `day` can be wrong if the local clock is wrong or if a report is delayed around JST midnight. `poi-server` should store server receive time separately, and the external builder should compare client day against server-receive JST day. If they differ outside an expected near-midnight window, quarantine or lower confidence for that observation.

### Payload batching

`remodel_slotlist` can report multiple rows. Use one POST with:

```json
{
  "data": {
    "records": []
  }
}
```

Keep single-record payload support on the backend:

```json
{
  "data": {}
}
```

Use source-specific payload rules:

| Source      | Required fields                                                                                                                                                                                  | Must not include                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `list`      | `schemaVersion`, `source`, `recipeId`, `itemId`, `day`, `observedSecondShipId` or confirmed `observedSecondShipId: 0`                                                                            | `slotId`, exact costs if only detail can prove them, `requiredHelperId`               |
| `detail`    | `schemaVersion`, `source`, `recipeId`, `itemId`, `itemLevel`, `stage`, `day`, `observedSecondShipId` or confirmed `observedSecondShipId: 0`, costs, required item arrays                         | `slotId`, `requiredHelperId`                                                          |
| `execution` | `schemaVersion`, `source`, `recipeId`, `itemId`, `itemLevel`, `day`, `observedSecondShipId` or confirmed `observedSecondShipId: 0`, `upgradeObserved: true`, successful conversion target fields | `slotId`, normal star-increment results, success-rate-only fields, `requiredHelperId` |

### Privacy and safety

Do not include:

- `api_token`
- admiral name
- roster slot item IDs such as `postBody.api_slot_id`
- raw request headers
- deck/ship inventory snapshots beyond the helper/flagship master IDs needed for recipe conditions

OK to include:

- equipment master IDs
- helper/flagship master IDs
- item star level
- cost fields
- reporter origin/user agent

Raw API payloads must not be logged or stored by default. If raw observation storage is enabled later, it must use an explicit allowlist/redaction schema first. Malformed-payload logging should include only sanitized normalized fields, validation error names, and source type.

## Backend design in `poi-server`

### Existing backend

Current files:

- `src/controllers/api/report/v2.ts`
- `src/controllers/api/report/v3.ts`
- `src/models/report/recipe.ts`
- `src/models/index.ts`

Current v2 route:

- `POST /api/report/v2/remodel_recipe`

Current model:

- `RecipeRecord`

Do not break this path. Add v3 models/routes in parallel.

### New Mongoose models

Add `src/models/report/item-improvement-recipe.ts`.

Use separate fact models for data with different certainty levels. Do not store list, detail, and execution observations in one last-write-wins document.

#### `ItemImprovementRecipeAvailabilityFact`

Stores list/menu availability observations from `remodel_slotlist`.

Availability proves that an item appeared for a helper/day, but it does not prove exact star-level costs. It must not be used directly to emit public cost rows.

Suggested payload:

```ts
export interface ItemImprovementRecipeAvailabilityFactPayload {
  key: string
  schemaVersion: number
  recipeId: number
  itemId: number
  day: number
  observedSecondShipId: number
  observedFlagshipIds: number[]
  sources: string[]
  origins: string[]
  firstReported: number
  lastReported: number
  count: number
}
```

Suggested key:

```text
v1|availability|recipeId|itemId|day|observedSecondShipId
```

Suggested schema:

```ts
const ItemImprovementRecipeAvailabilityFactSchema = new mongoose.Schema({
  key: String,
  schemaVersion: Number,
  recipeId: Number,
  itemId: Number,
  day: Number,
  observedSecondShipId: Number,
  observedFlagshipIds: [Number],
  sources: [String],
  origins: [String],
  firstReported: Number,
  lastReported: Number,
  count: Number,
})
```

Suggested indexes:

```ts
ItemImprovementRecipeAvailabilityFactSchema.index({ key: 1 }, { unique: true })
ItemImprovementRecipeAvailabilityFactSchema.index({ lastReported: 1, _id: 1 })
ItemImprovementRecipeAvailabilityFactSchema.index({ itemId: 1, observedSecondShipId: 1, day: 1 })
ItemImprovementRecipeAvailabilityFactSchema.index({ recipeId: 1 })
```

#### `ItemImprovementRecipeCostFact`

Stores exact cost/material observations from `remodel_slotlist_detail`.

Suggested TypeScript payload:

```ts
export interface RequiredItem {
  id: number
  count: number
}

export interface ItemImprovementRecipeCostFactPayload {
  key: string
  schemaVersion: number
  recipeId: number
  itemId: number
  itemLevel: number
  stage: number
  day: number
  observedSecondShipId: number
  observedFlagshipIds: number[]
  fuel: number
  ammo: number
  steel: number
  bauxite: number
  buildkit: number
  remodelkit: number
  certainBuildkit: number
  certainRemodelkit: number
  reqSlotItems: RequiredItem[]
  reqUseItems: RequiredItem[]
  changeFlag?: number
  sources: string[]
  origins: string[]
  firstReported: number
  lastReported: number
  count: number
}
```

Suggested schema:

```ts
const RequiredItemSchema = new mongoose.Schema(
  {
    id: Number,
    count: Number,
  },
  { _id: false },
)

const ItemImprovementRecipeCostFactSchema = new mongoose.Schema({
  key: String,
  schemaVersion: Number,
  recipeId: Number,
  itemId: Number,
  itemLevel: Number,
  stage: Number,
  day: Number,
  observedSecondShipId: Number,
  observedFlagshipIds: [Number],
  fuel: Number,
  ammo: Number,
  steel: Number,
  bauxite: Number,
  buildkit: Number,
  remodelkit: Number,
  certainBuildkit: Number,
  certainRemodelkit: Number,
  reqSlotItems: [RequiredItemSchema],
  reqUseItems: [RequiredItemSchema],
  changeFlag: Number,
  sources: [String],
  origins: [String],
  firstReported: Number,
  lastReported: Number,
  count: Number,
})

ItemImprovementRecipeCostFactSchema.index({ key: 1 }, { unique: true })
ItemImprovementRecipeCostFactSchema.index({ lastReported: 1, _id: 1 })
ItemImprovementRecipeCostFactSchema.index({
  itemId: 1,
  observedSecondShipId: 1,
  day: 1,
  itemLevel: 1,
})
ItemImprovementRecipeCostFactSchema.index({ recipeId: 1 })
```

Cost fact key must include all cost/requirement fields that define a candidate recipe. This preserves conflicts instead of overwriting them:

```text
v1|cost|recipeId|itemId|itemLevel|day|observedSecondShipId|fuel|ammo|steel|bauxite|buildkit|remodelkit|certainBuildkit|certainRemodelkit|reqSlotItemsHash|reqUseItemsHash|changeFlag
```

Canonical key rules:

1. Parse all numeric fields as base-10 integers.
2. Reject records missing required exact cost fields for detail facts.
3. Normalize absent `changeFlag` to `0`.
4. Normalize `reqSlotItems` and `reqUseItems` before hashing:
   - convert absent/zero API fields to empty arrays
   - reject or quarantine malformed non-empty entries
   - sum duplicate IDs
   - sort by ID
   - serialize as `id:count,id:count`; use `-` for empty arrays
5. Hash the final key string only if Mongo key length becomes a concern; otherwise store both `key` and optional `keyHash` for debugging.

#### `ItemImprovementRecipeUpdateFact`

Stores update-target observations from successful `remodel_slot` calls. Keep this separate from cost facts so detail observations cannot erase update targets and conflicting update targets remain visible.

Only actual item conversions belong in this collection. Normal successful improvements where the item remains the same must not create update facts.

Suggested payload:

```ts
export interface ItemImprovementRecipeUpdateFactPayload {
  key: string
  schemaVersion: number
  recipeId: number
  itemId: number
  itemLevel: number
  day: number
  observedSecondShipId: number
  observedFlagshipIds: number[]
  upgradeToItemId: number
  upgradeToItemLevel: number
  upgradeObserved: true
  sources: string[]
  origins: string[]
  firstReported: number
  lastReported: number
  count: number
}
```

Suggested key:

```text
v1|update|recipeId|itemId|itemLevel|day|observedSecondShipId|upgradeToItemId|upgradeToItemLevel
```

Validate `api_remodel_id[0] === itemId` before accepting the update fact. If it does not match, reject or quarantine the record instead of storing a contradictory `beforeItemId`.

Suggested indexes:

```ts
ItemImprovementRecipeUpdateFactSchema.index({ key: 1 }, { unique: true })
ItemImprovementRecipeUpdateFactSchema.index({ lastReported: 1, _id: 1 })
ItemImprovementRecipeUpdateFactSchema.index({
  itemId: 1,
  observedSecondShipId: 1,
  day: 1,
  itemLevel: 1,
})
ItemImprovementRecipeUpdateFactSchema.index({ recipeId: 1 })
ItemImprovementRecipeUpdateFactSchema.index({ upgradeToItemId: 1 })
```

#### Optional raw observation model

Only add this if storage volume is acceptable.

```ts
export interface ItemImprovementRecipeObservationPayload {
  schemaVersion: number
  source: 'list' | 'detail' | 'execution'
  normalized: unknown
  raw?: unknown
}
```

Use this collection for:

- auditing conflicts
- backfilling newly discovered fields
- investigating schema changes after game updates

If storage is a concern, skip raw observation storage. Do not keep unsanitized raw payloads in Sentry/error logs.

### V3 ingestion endpoint

Add to `src/controllers/api/report/v3.ts`:

- `POST /item_improvement_recipe`, mounted as `POST /api/report/v3/item_improvement_recipe`

Behavior:

1. Parse `ctx.request.body.data`.
2. Accept either `data.records` or a single `data` record.
3. Normalize every record:
   - for `detail` records, `reqSlotItems` and `reqUseItems` must be present arrays, even when empty
   - absent arrays become `[]` only for source types where the arrays are not meaningful, such as `list`
   - confirmed no-second-ship context becomes `observedSecondShipId: 0`
   - absent/unknown second-ship context is rejected or quarantined
   - absent/zero API required-item fields become `[]`
   - malformed non-empty required-item entries are rejected or quarantined, not dropped
   - `origin` defaults to `X-Reporter` or `User-Agent`
4. Validate source-specific required fields:
   - `list`: `schemaVersion`, `source`, `recipeId`, `itemId`, `day`, and known `observedSecondShipId`
   - `detail`: all `list` fields plus `itemLevel`, `stage`, exact cost fields, and present `reqSlotItems`/`reqUseItems` arrays
   - `execution`: `schemaVersion`, `source`, `recipeId`, `itemId`, `itemLevel`, `day`, known `observedSecondShipId`, `upgradeObserved: true`, `upgradeToItemId`, and `upgradeToItemLevel`
5. Build the deterministic key for the target fact type.
6. Upsert the corresponding fact collection:
   - `list` -> `ItemImprovementRecipeAvailabilityFact`
   - `detail` -> `ItemImprovementRecipeCostFact`
   - `execution` -> `ItemImprovementRecipeUpdateFact`

Use `observedSecondShipId: 0` only for confirmed "no second ship". If second-ship context cannot be read reliably, reject or quarantine the record instead of converting it to no-second-ship.

Recommended upsert:

```ts
await Model.updateOne(
  { key: record.key },
  {
    $set: {
      ...stableFields,
    },
    $setOnInsert: {
      firstReported: lastReported,
      count: 0,
    },
    $max: {
      lastReported,
    },
    $addToSet: {
      sources: record.source,
      origins: record.origin,
      observedFlagshipIds: record.observedFlagshipId,
    },
    $inc: {
      count: 1,
    },
  },
  { upsert: true },
)
```

Never use `$set` to overwrite candidate-defining values such as costs, required items, or update targets. Those values belong in the fact key or in a separate fact collection so the external builder can see conflicts.

### Export endpoints

`poi-server` does not need to serve the final UI. It should export raw/fact data to a downstream builder.

Add read endpoints under v3:

- `GET /api/report/v3/item_improvement_recipes/availability`
- `GET /api/report/v3/item_improvement_recipes/costs`
- `GET /api/report/v3/item_improvement_recipes/updates`
- Optional: `GET /api/report/v3/item_improvement_recipes/raw`

Query parameters:

| Parameter      | Meaning                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `updatedAfter` | Return records with `lastReported > updatedAfter`.                       |
| `afterId`      | Cursor for stable pagination when many records share the same timestamp. |
| `limit`        | Max rows, clamped server-side, e.g. 1-1000.                              |

Cursor predicate:

```ts
{
  $or: [
    { lastReported: { $gt: updatedAfter } },
    { lastReported: updatedAfter, _id: { $gt: afterId } },
  ],
}
```

Response shape:

```json
{
  "records": [],
  "next": {
    "updatedAfter": 1710000000000,
    "afterId": "65ef..."
  }
}
```

Sort by:

```js
{ lastReported: 1, _id: 1 }
```

Access control:

- If the endpoint is internal only, protect it by network policy or an admin token.
- If it is public, only expose normalized fact records, omit raw fields, and omit or coarsen `origins` because reporter/user-agent data can fingerprint client versions.

### Backfill old v2 data

Add a script in `poi-server` later, not in `plugin-report`:

1. Read `RecipeRecord`.
2. Convert:
   - `secretary` -> `observedSecondShipId`
   - `reqItemId/reqItemCount` -> `reqSlotItems`
   - `stage` preserved, `itemLevel` unknown
   - old rows become advisory legacy records, not exact v3 cost facts
3. Store legacy rows in a separate `LegacyStageRecipeFact` or external-builder staging table because `ItemImprovementRecipeCostFact` requires exact `itemLevel`.
4. Mark `source: "legacy-v2"`.
5. Keep `firstReported/lastReported/count` from the existing row when possible, but do not let legacy counts satisfy high confidence without v3 detail confirmation.

## External canonical database builder

The builder consumes exported facts and produces a UI-oriented canonical database.

### Inputs

- v3 fact export from `poi-server`
- optional raw observations
- Kancolle master data for item/ship names
- optional manual overrides for known wiki-confirmed recipes

### Canonical record shape

```ts
interface CanonicalItemImprovementRecipe {
  itemId: number
  itemName?: string
  helperRequirement: 'none' | 'ship' | 'unknown'
  requiredHelperId?: number
  requiredHelperName?: string
  observedSecondShipIds: number[]
  days: number[]
  starMin: number
  starMax: number
  fuel: number
  ammo: number
  steel: number
  bauxite: number
  buildkit: number
  remodelkit: number
  certainBuildkit: number
  certainRemodelkit: number
  reqSlotItems: RequiredItem[]
  reqUseItems: RequiredItem[]
  upgradeToItemId?: number
  upgradeToItemLevel?: number
  confidence: 'low' | 'medium' | 'high' | 'manual'
  sampleCount: number
  conflictCount: number
  firstSeen: number
  lastSeen: number
}
```

### Aggregation algorithm

1. Import facts incrementally by cursor.
2. Import availability, cost, and update facts separately.
3. Normalize arrays by summing duplicate IDs and sorting `(id, count)` pairs.
4. Build UI cost records only from exact detail-derived `ItemImprovementRecipeCostFact` rows.
5. Use `ItemImprovementRecipeAvailabilityFact` rows only to:
   - show coverage/missing-detail hints
   - confirm that a menu item is visible for a day/observed-second-ship context
   - seed investigation queues
     Availability-only facts must not produce public rows with unknown star ranges or costs.
6. Group exact cost facts by:
   - `recipeId`
   - `itemId`
   - `observedSecondShipId`
   - `day`
   - `itemLevel`
7. Within the same exact group, detect conflicts:
   - different costs
   - different required equipment/items
8. Join update facts by `recipeId`, `itemId`, `observedSecondShipId`, `day`, and `itemLevel`; treat multiple targets as conflicts unless manually resolved.
9. Pick a winning candidate:
   - manual override first
   - trusted source confirmation
   - highest total count
   - newest sample only as a tie-breaker
10. Merge adjacent star levels into display ranges only when all display fields match:

- costs
- required equipment/items
- update target
- observed second ship context
- day

11. Infer helper requirement after grouping:

- observations with `observedSecondShipId: 0` prove the recipe can appear without a second ship for that day/item/star/cost shape; emit `helperRequirement: "none"`
- observations with a nonzero second ship prove availability in that second-ship context, but not by themselves that the ship is required
- when a `helperRequirement: "none"` row has the same recipe/cost/day/star/update shape as nonzero `observedSecondShipId` rows, merge the nonzero observations into `observedSecondShipIds` for the no-helper canonical row instead of emitting duplicate unknown-helper UI rows
- infer `helperRequirement: "ship"` and `requiredHelperId` only when cross-context observations and/or manual/wiki data support it
- otherwise emit `helperRequirement: "unknown"` and hide or mark the row as unresolved in public UI

12. Merge weekdays only when all non-day display fields match, including inferred `helperRequirement` and `requiredHelperId`.
13. Export canonical records for the UI.

### Confidence policy

Initial suggested thresholds:

| Confidence | Rule                                                                               |
| ---------- | ---------------------------------------------------------------------------------- |
| `manual`   | Curated override exists.                                                           |
| `high`     | Manual/wiki-confirmed or confirmed by trusted ingestion channels and no conflicts. |
| `medium`   | Multiple matching v3 detail samples and no conflicts.                              |
| `low`      | Single sample or conflict unresolved.                                              |

`origin`/`User-Agent` is useful for debugging reporter versions, but it is spoofable and must not be treated as an independent-user identity. Legacy v2 counts should not satisfy `high` confidence without v3 detail confirmation or manual review. These thresholds can be tuned once real data volume is known.

### Coverage tracking

Completeness cannot be proven from one API dump. Track coverage as a matrix:

- item ID
- helper ID
- JST weekday
- star level or star range

Builder/admin reports should show:

- recipes observed in list but never in detail
- detail facts missing exact star coverage
- update-capable recipes with no observed conversion update fact
- conflicting facts requiring review
- stale recipes not seen after a game update

## UI requirements for the canonical data

The canonical DB should support:

| UI query                          | Needed indexes in canonical service             |
| --------------------------------- | ----------------------------------------------- |
| What can I remodel today?         | `days`, optionally `requiredHelperId`           |
| What can this helper remodel?     | `requiredHelperId`, `days`                      |
| Which helper/days for this item?  | `itemId`                                        |
| What does this star range cost?   | `itemId`, `requiredHelperId`, `starMin/starMax` |
| What can update into this target? | `upgradeToItemId`                               |

Possible UI API endpoints in the separate canonical service:

- `GET /api/remodel-recipes?day=1`
- `GET /api/remodel-recipes?day=1&requiredHelperId=123`
- `GET /api/remodel-recipes?itemId=456`
- `GET /api/remodel-recipes/helpers?itemId=456`
- `GET /api/remodel-recipes/coverage`

## Implementation phases

### Phase 1: Client v3 reporting

Repository: `plugin-report`

Tasks:

1. Add normalization helpers.
2. Extend or replace `RemodelRecipeReporter` with v3 reporting.
3. Report list observations from `remodel_slotlist`.
4. Report detail observations from `remodel_slotlist_detail`.
5. Report conversion update facts from `remodel_slot`.
6. Keep v2 reporting unchanged until backend migration is complete.

Acceptance criteria:

- Opening the improvement list sends availability observations.
- Opening recipe detail sends exact cost/material observations even without execution.
- Executing an actual conversion creates a separate update fact with the update target.
- No personal/admiral identifiers are sent.
- Existing v2 reporting still works.

### Phase 2: Backend v3 ingestion/export

Repository: `poi-server`

Tasks:

1. Add `ItemImprovementRecipeAvailabilityFact`, `ItemImprovementRecipeCostFact`, and `ItemImprovementRecipeUpdateFact` models.
2. Export the models from `src/models/index.ts`.
3. Add `POST /api/report/v3/item_improvement_recipe`.
4. Add paginated export endpoints for availability, cost, and update facts.
5. Add validation and malformed-payload handling.
6. Add indexes for `key`, export cursor, and common aggregation dimensions.

Acceptance criteria:

- Single and batch payloads are accepted.
- Duplicate facts increment `count` without overwriting candidate-defining fields.
- Detail and execution observations are linked by the external builder without destructive backend updates.
- Export endpoints page deterministically.
- Old v2 endpoints remain unchanged.

### Phase 3: Backfill and external builder

Repository: external builder or scripts repo

Tasks:

1. Pull v3 facts from `poi-server` by cursor.
2. Backfill old `RecipeRecord` rows into advisory legacy staging records.
3. Implement conflict detection.
4. Implement star-level range merging.
5. Implement weekday merging.
6. Produce canonical records.
7. Generate coverage reports.

Acceptance criteria:

- Canonical output can answer day/helper/item lookup questions.
- Conflicts are visible and do not silently overwrite data.
- Low-confidence records can be hidden from public UI.
- Builder can resume from the last cursor.

### Phase 4: UI/API service

Repository: TBD

Tasks:

1. Import canonical records.
2. Add lookup endpoints.
3. Add indexes for day, required helper, item, and update target.
4. Build UI screens for today/helper/item lookups.
5. Add admin/debug coverage views.

Acceptance criteria:

- Users can query by day.
- Users can query by item.
- Users can find required helper and costs.
- Update paths are shown when known.
- Low-confidence/conflicting records are handled explicitly.

## Validation plan

### `plugin-report`

Existing `package.json` has no real test script. For implementation, either:

1. Add a focused test setup for reporter normalization/state logic, or
2. At minimum run lint/prepack-compatible checks already present in the repo.

Regression cases to cover:

- list-only availability report
- detail report without execution
- detail report with `api_req_useitem_id`
- detail report with second required equipment/item fields
- no helper ship
- exact item star levels 0, 6, 9, 10
- conversion update fact creation
- mismatch between cached detail and execution slot/recipe

### `poi-server`

Use existing commands:

- `npm run type-check`
- `npm run lint`

Add route/model tests if a test framework is introduced later; do not add unrelated tooling just for this change unless necessary.

Manual checks:

- POST one single record.
- POST a batch.
- POST duplicate records and verify `count`.
- POST detail then conversion execution and verify the cost fact remains unchanged while a separate update fact is created.
- GET facts with pagination and verify stable cursor behavior.

## Open design decisions

1. Whether `poi-server` should store raw observations or only normalized facts.
2. Whether export endpoints are public, internal-network-only, or token-protected.
3. Where the external builder and canonical UI service will live.
4. How to model helper remodel-line equivalence for UI display.
5. How much manual/wiki override data is acceptable in the canonical builder.

## Recommended next step

Implement Phase 1 and Phase 2 together behind v3 endpoints, then run the external builder against a small exported sample to validate that the facts can be merged into UI-ready records.
