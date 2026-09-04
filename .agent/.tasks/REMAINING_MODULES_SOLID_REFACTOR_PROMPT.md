# Prompt: Refactor Remaining Modules Toward SOLID Principles

You are a senior backend engineer working on the existing Smart Food backend.

Your task is to refactor the **remaining modules** — **Recommendation, IoT, User, Meal, Nutrition, Ingredient** — so they better follow SOLID principles, while preserving the current Express.js + TypeScript + Prisma project structure.

**Do not touch** the modules that are already refactored and reviewed: `auth`, `dish`, `notification`, `fridge`.

## Project Context

This is an existing production-oriented backend.

Stack:

- Node.js
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Redis
- MQTT
- ONNX Runtime
- Expo Push Notifications

The project is organized by technical layers:

- `src/controllers`
- `src/services`
- `src/routes`
- `src/middlewares`
- `src/validations`
- `src/utils`
- `src/config`
- `src/models`

Do not convert this project to Clean Architecture, feature-first modules, DDD, or a new framework. Work inside the current folder structure and make the smallest safe refactor that improves ownership and maintainability.

A prior SOLID analysis of these modules is available at `.agent/.tasks/SOLID_ANALYSIS_REMAINING_MODULES.md`. Read it first; it lists every violation with `file:line` references and a proposed fix for each module.

## Main Goal

Refactor so that:

1. Controllers remain thin — they extract request data, call one service method, and return a standardized response.
2. Each service owns one clear responsibility; no service acts as a "God object".
3. No circular dependency exists between service files.
4. No business logic is hardcoded as inline data inside a service (mock data moves to a dedicated file).
5. `any` types in domain services are replaced with the existing typed interfaces.
6. Existing API behavior, route contracts, and response shapes are preserved unless a change is clearly required.
7. The refactor is incremental and does not introduce unnecessary architecture.

## Files To Inspect First

Before editing code, inspect at least these files:

- `src/services/recommendation.service.ts`
- `src/services/recommendation.queue.service.ts`
- `src/services/recommendation.inputHydration.service.ts`
- `src/services/iot.service.ts`
- `src/services/user.service.ts`
- `src/services/meal.service.ts`
- `src/services/nutrition.service.ts`
- `src/services/ingredient.service.ts`
- `src/controllers/recommendation.controller.ts`
- `src/controllers/iot.controller.ts`
- `src/controllers/user.controller.ts`
- `src/routes/v1/recommendation.route.ts`
- `src/routes/v1/iot.route.ts`
- `src/models/interfaces/recommendation.interface.ts`
- `src/models/interfaces/meal.interface.ts`
- `src/models/interfaces/nutrition.interface.ts`
- `src/models/interfaces/ingredient.interface.ts`
- `src/constants/cache.constants.ts`
- `src/utils/cache.ts`
- `src/config/config.ts`
- `src/index.ts`
- `.agent/.tasks/SOLID_ANALYSIS_REMAINING_MODULES.md`

**Do not create any test files.** This refactor is verified by the TypeScript build only.

---

## Module 1 — Recommendation (highest priority)

**Files:** `src/services/recommendation.service.ts`, `recommendation.queue.service.ts`, `recommendation.inputHydration.service.ts`, `src/controllers/recommendation.controller.ts`.

### Current problems to fix

#### 1.1 Circular dependency between `recommendation.service.ts` and `recommendation.queue.service.ts`

- `recommendation.service.ts` imports `enqueueRecommendationJob` from `recommendation.queue.service`.
- `recommendation.queue.service.ts` imports `recommendationService.generateRecommendation` (queue.service lines 14, 156).
- This circular dependency must be broken.

Break it like this:

- The worker must **not** import `recommendation.service`. Inject the `generateRecommendation` function into the worker as a parameter (constructor/argument), so the queue module owns no AI-generation logic.
- Alternatively, move the worker's call to a small dedicated function passed in when the worker is initialized from `src/index.ts`.

#### 1.2 `recommendation.service.ts` is a God object

It currently owns: job create/get/update + DB persistence, Redis caching, AI generation (mock/real), sub-recommendation search, plan update with a large transaction, shopping-list rebuild, and dish nutrition calculation.

Split it into focused service files (follow the direction already set by `REFACTOR_RECOMMEND.md` and the existing `recommendation.inputHydration.service.ts` pattern):

- `recommendation.job.service.ts` — create / get / list / update job (DB + cache).
- `recommendation.aiAdapter.service.ts` — `generateRecommendation`: choose mock vs real provider. Move the `RECOMMENDATION_OUTPUT_TEMPLATE` constant (lines 24–125) out of `recommendation.service.ts` into a dedicated `recommendation.mockData.ts` file.
- `recommendation.sub.service.ts` — `getSubRecommendations` (search replacement dishes).
- `recommendation.nutrition.service.ts` — `calculateDishesNutrition`, `rebuildShoppingList`.
- `recommendation.queue.service.ts` — keep queue + worker wiring, but only via injected dependencies (see 1.1).

The exported object of `recommendation.service.ts` may stay as a thin facade re-exporting the split services to minimize import churn across the codebase — or update import sites directly if that is cleaner. Prefer whichever causes the least churn while keeping responsibilities split.

#### 1.3 `recommendation.queue.service.ts` mixes queue, worker, DB, cache, and notification

- `initRecommendationWorker` (lines 79–323) currently does everything: init BullMQ, read job, update DB status, call AI, write Redis cache, send push notification, handle `failed` event.
- Extract the job-processing handler into its own function/service (`recommendation.worker.service.ts`) that receives the pieces it needs (e.g. `generateRecommendation` injected). The queue file should only wire the queue and register the handler.

#### 1.4 Replace `any` with existing typed interfaces

Replace `any` in:

- `getMissingIngredients(... any[])` → use the dish-ingredient shape already present in `src/models/interfaces/recommendation.interface.ts` (`IMealDish`, `IPlanDay`, `IRecommendationOutput`, `IMissingIngredient`, `IShoppingItem`, `IDayMeals`).
- `rebuildShoppingList(... any[])`
- `getSubRecommendations` return type `any[]`
- `updateRecommendation` casts of `output as any`

Keep behavior identical; only tighten the types.

### Preserve

- `POST /recommendations`, `GET /recommendations/`, `GET /recommendations/:jobId`, `POST /recommendations/subs`, `PATCH /recommendations/:jobId`.
- Job status lifecycle `PENDING → PROCESSING → SUCCESS | FAILED`.
- Redis cache behavior for jobs (7-day TTL, `recommendation:job:<id>` key).
- Mock data shape exactly as it is today (it is the fallback contract).
- Push notification after successful generation is best-effort and must never fail the job.
- All request/response contracts and validation behavior.

---

## Module 2 — IoT

**Files:** `src/services/iot.service.ts`, `src/controllers/iot.controller.ts`, `src/routes/v1/iot.route.ts`.

### Current problems to fix

`iot.service.ts` (594 lines) is the largest God object. It owns: scan queue + concurrency, Cloudinary upload, MQTT publish, SSE streaming, AI inference orchestration, Redis heartbeat + online status, and device CRUD (pair/unpair/list/status).

Split it into focused service files, following the existing `fridge.service` / `fridgeInventory.service` / `fridgeTransaction.service` pattern already used in this project:

- `iot.scanQueue.service.ts` — scan job queue + concurrency control (currently lines 57–67, 276–319).
- `iot.scanProcessor.service.ts` — orchestrates: AI predict → ingredient nutrition → publish result (currently `executeScanJob`, lines 151–274). Accept dependencies via constructor/arguments rather than importing them directly.
- `iot.mqttPublisher.service.ts` — publish scan result + subscribe to heartbeat topic. Move the module-scope side effect (`mqttService.subscribe(HEARTBEAT_TOPIC, ...)`, line 369) into an explicit `init()` function called from `src/index.ts` — do not subscribe at module load.
- `iot.sse.service.ts` — SSE client registry + streaming (currently `sseClients` map, lines 29, 69–94, 406–439).
- `iot.device.service.ts` — `pairDevice`, `getMyDevices`, `getDeviceStatus`, `unpairDevice` (lines 441–583).
- Cloudinary upload for scan images — reuse `src/services/upload.service.ts` where reasonable instead of duplicating upload logic.

The exported object of `iot.service.ts` may stay as a thin facade re-exporting the split services to keep `iot.controller.ts` imports stable — or update the controller directly if cleaner.

### Preserve

- `POST /iot/scan`, `GET /iot/devices/:deviceUid/stream` (SSE), `POST /iot/devices/pair`, `GET /iot/devices`, `GET /iot/devices/:deviceUid/status`, `DELETE /iot/devices/:deviceUid/pair`.
- SSE event format (`event: scan-result`), MQTT topic names, heartbeat Redis key + TTL, online threshold logic, and queue concurrency behavior.
- Cloudinary folder conventions (`smart-food/<label>`, fallback `unknown`).

---

## Module 3 — User

**Files:** `src/services/user.service.ts`, `src/controllers/user.controller.ts`, `src/routes/v1/user.route.ts`.

### Current problems to fix

#### 3.1 `user.service.ts` mixes three unrelated responsibilities

Split them:

- Keep `user.service.ts` for user CRUD + profile (`createUser`, `queryUsers`, `getUserById`, `getUserByEmail`, `updateUserById`, `deleteUserById`, `getMe`, `updateMe`).
- Move `createPushToken` (lines 255–267) into `src/services/pushToken.service.ts`.
- Move `clearGlobalCache` (lines 269–274) out of the user domain. It currently calls `redis.flushall()` and logs with `console.log`. Replace `flushall()` with prefix-scoped deletion (reuse `utils/cache.ts` `invalidateByPrefix` or a dedicated `cache.service.ts`) and use the project `logger` instead of `console.log`.

#### 3.2 `user.controller.ts` calls `notificationService` and infra directly

- `sendTestNotification` (lines 84–98) calls `notificationService.sendNotificationToAllUsers` directly from the controller.
- `clearCache` (lines 99–107) calls `userService.clearGlobalCache`.
- Move these behind a thin service (e.g. `system.service.ts` or the new `pushToken`/`cache` services). Controllers must not import infrastructure or third-party services directly.

#### 3.3 Response format is inconsistent

- `createUser`, `getUsers`, `getUser`, `updateUser` return raw `res.send(user)`.
- `getMe`, `updateMe`, `createPushToken`, `clearCache` use `successResponse`.
- Standardize all user endpoints to use `successResponse` with the same shape as the rest of the codebase. Preserve the existing HTTP status codes.

#### 3.4 Contract inconsistency (LSP)

- `getUserById`/`getMe` return different shapes (`Pick<User, Key>` vs `IUser`). Align them on one user contract (`IUser`, password excluded) where it is safe.
- `getUsers` returns a raw array while other list endpoints return `{ control, results }`. Add the pagination shape to `getUsers` if it does not break the existing contract — otherwise leave the shape unchanged but document why.

### Preserve

- `POST /users`, `GET /users`, `GET /users/me`, `PATCH /users/me`, `POST /users/push-tokens`, `POST /users/clear-cache`, `POST /users/test-notification`, `GET/PATCH/DELETE /users/:userId`.
- Route-level auth (`auth('manageUsers')`, `auth('getUsers')`) and validation behavior.

---

## Module 4 — Meal

**Files:** `src/services/meal.service.ts`, `src/controllers/meal.controller.ts`.

### Current problems to fix

#### 4.1 Duplicated create-meal flows

`createMealFromExistingDish` (lines 278–376) and `createCustomMeal` (lines 378–468) share ~2/3 identical logic: `getFridgeContext` → `buildSnapshotsByAvailableQuantity` → create `mealLog` + snapshots → `deductFridgeItems` → `getMealHistoryById`.

Extract the shared "create meal log + deduct fridge" step into one internal helper that both flows call, parameterized by (`dishId` or `customName`/`tag`, `snapshots`, `totals`, ...). Behavior must stay identical.

#### 4.2 Direct dependency on the fridge module (DIP)

- `meal.service.ts` imports `fridgeInventoryService` directly (line 5). Introduce a small port/interface (a local type + a thin adapter that wraps `fridgeInventoryService`) so the meal service depends on an abstraction, or keep the direct import only if moving it would create churn — choose the minimal safe option and document it.

### Preserve

- `POST /meals`, `GET /meals/history`, `GET /meals/history/:mealLogId`.
- Meal-log snapshot schema, fridge deduction semantics, `allowMissingIngredients` behavior, and all error messages/status codes.

---

## Module 5 — Nutrition and Ingredient (light touch)

**Files:** `src/services/nutrition.service.ts`, `src/services/ingredient.service.ts`.

### Nutrition

- `getDailyRemainingNutrition` (lines 155–202) queries `prisma.user` and computes TDEE inline. Move the "fetch user body metrics" part to a small helper (e.g. `userMetric.service.ts`) or keep it but extract the user fetch + TDEE computation into a named function so the nutrition service only aggregates nutrition. Do not over-engineer.
- Behavior and response shapes must be preserved.

### Ingredient

- `ingredient.service.ts` imports `contentNotificationService` (lines 15, 44, 67, 135) and the `cache` util directly. This is acceptable in the current architecture; do **not** rebuild it. Optionally move cache invalidation into a small internal function if it improves readability, but no API change.
- Do not change the ingredient endpoints, cache keys, or TTLs.

---

## Cross-cutting cleanup (only where touched by the modules above)

- `src/services/index.ts` barrel is inconsistent: only 5 services are exported while controllers import the rest directly. Do **not** rewrite the barrel. Only update it if the refactor already touches the exports of the modules above.
- Keep `utils/calc.ts`, `utils/date.ts`, `utils/tdee.ts`, `utils/cache.ts` unchanged. They are already clean utilities.
- Fix any mojibake Vietnamese messages only on lines you touch.

## Constraints

Do not:

- rewrite the whole backend
- change folder architecture
- introduce dependency injection containers or a DI framework
- introduce a new framework or library
- change route paths
- change request validation contracts
- change response shapes or status codes
- move business logic into routes, validations, middlewares, or utils
- modify the Prisma schema
- add Redis/MQTT/notification configuration changes
- create any test files

Prefer:

- small focused service files
- existing project style (default-export object of functions, matching the current services)
- explicit function names
- minimal import churn (a thin facade re-export is acceptable where it avoids large import rewrites)
- TypeScript type safety (no new `any`)
- preserving existing behavior exactly

## Suggested Implementation Order

1. Read `.agent/.tasks/SOLID_ANALYSIS_REMAINING_MODULES.md` and all files listed under **Files To Inspect First**.
2. **Recommendation** — break the circular dependency first (highest risk), then split the God object, move mock data to its own file, extract the worker handler, and replace `any` with the typed interfaces.
3. **IoT** — split scan queue / scan processor / MQTT / SSE / device services; move Cloudinary upload to reuse `upload.service.ts`; move the MQTT subscribe side effect into an `init()`.
4. **User** — split push token + cache out of `user.service.ts`, move `sendTestNotification`/`clearCache` behind a service, standardize response format.
5. **Meal** — extract the shared create-meal-log helper; address the fridge dependency.
6. **Nutrition / Ingredient** — light extraction only.
7. Run verification.

## Verification

After the refactor, run:

```bash
pnpm build
```

**This is the hard gate.** The task is not complete if the TypeScript build fails.

Also run, if it is configured and passes without new failures:

```bash
pnpm lint
```

If lint reports issues that are unrelated to your changes or pre-existing, do not fix them broadly — report them.

**Do not create, modify, or run any test files.**

If a verification command cannot run because of a missing dependency or environment restriction, report that clearly with the exact reason. Do not claim success on a failing build.

## Acceptance Criteria

The refactor is complete when:

- No circular dependency remains between `recommendation.service.ts` and `recommendation.queue.service.ts`.
- `recommendation.service.ts` (and its split modules) no longer contains the inline mock template; mock data lives in a dedicated file.
- The recommendation worker no longer imports `recommendation.service` directly to generate output.
- `iot.service.ts` no longer acts as a single God object; scan / SSE / MQTT / device responsibilities live in separate files.
- `iot` no longer subscribes to MQTT at module load; subscription happens via an explicit init called from `src/index.ts`.
- `user.service.ts` no longer owns push-token and global-cache logic.
- `user.controller.ts` no longer imports `notificationService` or infrastructure directly.
- All user endpoints return a consistent `successResponse` shape.
- The shared create-meal-log helper removes the duplicated meal flow.
- No new `any` is introduced in domain services.
- `pnpm build` passes with no errors.
- No API behavior, route, response, or status-code changed.
- No test files were created.

## Final Response Expected From The AI

When finished, summarize:

- what files changed (and any new files created)
- what responsibilities moved where
- how the circular dependency was broken
- what verification commands were run and their results
- whether any behavior changed (it should not)
- any remaining risks or follow-up recommendations
