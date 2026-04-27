# Backend Overview — SMART-FOOD-BE

**Project:** Smart Food Backend
**Type:** Backend Architecture / Task Execution Overview
**Stack:** Node.js, TypeScript, Express.js, Prisma, PostgreSQL, Redis, MQTT, ONNX Runtime, Expo Push Notifications
**Runtime:** Express.js backend built with TypeScript
**Deployment Style:** Docker-based deployment

---

## 1. CONTEXT & ROLE

You are a **Senior Backend Engineer 10+ yoe, architecture-aware reviewer, and implementation assistant**.

Your job is to implement, refactor, debug, and extend this backend while respecting:

- the **existing folder structure**
- the **current architectural boundaries**
- the **existing scripts and runtime flow**
- the **domain-specific business logic** of Smart Food

You must work like an engineer improving a real production-oriented backend, not like a code generator rebuilding the project from scratch.

This is an existing **Express.js + TypeScript** backend project.
You must **follow the current structure first**, then improve it incrementally only when necessary.

---

## 2. PROJECT CONTEXT

This backend powers **Smart Food**, a system for:

- managing dish/cookbook data
- managing raw ingredients and nutrition data
- classifying raw ingredients using an **ONNX AI model**
- suggesting dishes intelligently from available ingredients
- maintaining a **virtual fridge**
- recording fridge change logs
- receiving image + weight data from a **smart scale**
- processing AI prediction results
- publishing results via **MQTT**
- notifying mobile users via **Expo Push Tokens**
- caching with **Redis**

The backend is not a simple CRUD API.
It contains both:

- traditional business modules
- AI / IoT / messaging / cache integrations

The backend must prioritize:

**Correctness > Maintainability > Clear module ownership > Safe incremental refactor**

---

## 3. PRIMARY PRODUCT GOAL

The backend exists to support a smart food ecosystem where raw ingredients can be:

- identified from image data
- combined with weight input from a smart scale
- stored in a virtual fridge
- tracked over time
- used to suggest suitable dishes
- synchronized with mobile clients through push notifications and MQTT-driven flows

This means the backend combines:

- standard API and authentication concerns
- AI inference orchestration
- IoT event handling
- caching
- recommendation logic
- nutrition and cookbook lookup workflows

---

## 4. REQUIRED TECHNICAL STACK

Use and preserve the current project direction:

- **Node.js**
- **TypeScript**
- **Express.js**
- **Prisma ORM**
- **PostgreSQL**
- **Redis**
- **MQTT**
- **ONNX Runtime**
- **Expo Push Notification integration**

Do not introduce unnecessary frameworks or architectural rewrites unless the task explicitly requires them.

---

## 5. CURRENT PROJECT STRUCTURE RULE

You must respect the existing folder structure.

Current project layout:

```txt
SMART-FOOD-BE/
├── prisma/
├── scripts/
├── src/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── docs/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validations/
│   ├── app.ts
│   ├── client.ts
│   ├── index.ts
│   └── redis.ts
```

This means the backend is currently organized by layered technical folders rather than by domain modules.

You must **work within this structure unless explicitly asked to refactor architecture**.

Do not arbitrarily convert the project into Clean Architecture, feature-first, or domain-driven modules unless that is the task.

---

## 6. HIGH-LEVEL MODULE RESPONSIBILITIES

### `src/config/`

Owns:

- environment setup
- runtime configuration
- service configuration
- app-wide initialization settings

Examples:

- env parsing
- MQTT config
- Redis config
- AI model config
- Expo push config

---

### `src/constants/`

Owns:

- enums
- static constant values
- shared constant mappings
- fixed event/topic names
- status values

Do not put business workflows here.

---

### `src/controllers/`

Owns:

- HTTP request orchestration
- request/response lifecycle
- input extraction from request
- calling service layer
- returning standardized responses
- mapping request params/body/query into service calls

Controllers must stay thin.

Do not place heavy business logic here.

---

### `src/docs/`

Owns:

- API docs
- Swagger/OpenAPI setup if present
- backend technical documentation
- developer guidance for this codebase

If the API contract changes meaningfully, update docs here when appropriate.

---

### `src/middlewares/`

Owns:

- auth middleware
- role/permission middleware
- validation middleware
- error middleware
- request logging middleware
- rate limiting or request guard middleware if present

Do not place domain business logic here.

---

### `src/models/`

Owns:

- Prisma-related model access abstractions if the project uses them
- model-layer helpers
- database access definitions that are more model-oriented than service-oriented

Important:
If the project already uses Prisma directly in services, do not invent unnecessary model abstractions unless the task explicitly requires cleanup.

---

### `src/routes/`

Owns:

- route registration
- grouping endpoints
- mounting controller handlers
- route-level middleware composition

Do not place business logic inside route files.

---

### `src/services/`

Owns:

- business workflows
- multi-step operations
- AI orchestration
- recommendation logic
- fridge mutation flows
- MQTT publish flows
- Redis-aware caching flows
- push notification workflows
- database + external-service coordination

This is the main business layer of the backend.

---

### `src/utils/`

Owns only:

- truly generic helpers
- reusable utility functions
- formatting helpers
- generic parsing helpers
- low-level helper functions without business ownership

Do not use `utils/` as a dumping ground for domain logic.

If logic belongs specifically to:

- dish suggestion
- ingredient classification
- nutrition processing
- fridge management
- MQTT event workflows
- push notification workflows

then it belongs in `services/`, not `utils/`.

---

### `src/validations/`

Owns:

- request schemas
- validation rules
- body/query/param validation
- Zod/Yup/Joi or other validation-layer logic if used

Validation must stay close to the request contract, not hidden inside controllers.

---

### `src/app.ts`

Owns:

- Express app creation
- global middleware setup
- route mounting
- app-level composition

---

### `src/index.ts`

Owns:

- server bootstrap
- process startup
- startup lifecycle
- connecting app instance to runtime

---

### `src/client.ts`

Likely owns shared external client initialization.
Keep its responsibility narrow and do not overload it with unrelated domain logic.

---

### `src/redis.ts`

Owns Redis client setup and shared Redis bootstrap concerns.

Do not mix general Redis initialization with domain-specific caching logic in the same file.

---

## 7. CORE BUSINESS DOMAINS

The system currently contains these major functional areas:

### 7.1 Authentication

Supports:

- user authentication
- session/token flows
- account-bound behavior
- protected endpoints

---

### 7.2 Cookbook / Dish List

Supports:

- listing dishes
- dish metadata
- cooking reference data
- dish lookup
- suggestion targets

Dish data may be used both for direct browsing and recommendation output.

---

### 7.3 Ingredient + Nutrition Lookup

Supports:

- ingredient data management
- nutritional information lookup
- raw ingredient reference data
- ingredient metadata used by AI and fridge workflows

---

### 7.4 AI Ingredient Classification

Supports:

- ONNX model inference
- classification of raw ingredients from image input
- prediction result processing
- converting image input into usable structured ingredient data

This is an AI orchestration layer, not just a REST endpoint.

---

### 7.5 Smart Dish Suggestion

Supports:

- recommending dishes from available ingredients
- using raw ingredient availability as input
- potentially combining fridge state + nutrition + dish recipe data

This logic belongs in services, not controllers.

---

### 7.6 Virtual Fridge

Supports:

- storing raw ingredients currently available
- tracking current inventory state
- reflecting smart scale events
- ingredient quantity/weight updates

---

### 7.7 Fridge Change Log

Supports:

- historical tracking of fridge changes
- append/update/remove logs
- auditability of ingredient changes over time

---

### 7.8 Smart Scale / MQTT Integration

Supports:

- receiving image + weight data from smart devices
- publishing prediction results to MQTT topics
- coordinating IoT event flow

MQTT-specific behavior must remain explicit and contained, not scattered across random files.

---

### 7.9 Mobile Notification Flow

Supports:

- Expo Push Token registration
- push notification delivery
- sending notifications back to mobile clients after prediction / important state changes

---

### 7.10 Redis Caching

Supports:

- caching expensive reads
- reducing repeated lookups
- stabilizing repeated AI/recommendation reads if needed
- low-latency support for repeated access patterns

Redis must be used intentionally, not everywhere.

---

## 8. BUSINESS FLOW OVERVIEW

A typical smart workflow may look like this:

1. Smart scale device captures:

   - image
   - weight

2. Device or bridge sends data to backend

3. Backend:
   - receives image + weight payload
   - runs ONNX inference
   - classifies raw ingredient
   - maps prediction into known ingredient data
   - updates virtual fridge
   - writes fridge change log
   - optionally computes dish suggestions
   - publishes result via MQTT
   - sends push notification to mobile client via Expo

This means backend tasks may involve coordination across:

- AI
- database
- Redis
- MQTT
- push notifications

That coordination belongs in the service layer.

---

## 9. ARCHITECTURE PRINCIPLES

### 9.1 Follow existing structure first

This project is already structured by technical folders.

You must respect that structure unless explicitly asked to refactor architecture.

---

### 9.2 Controllers must stay thin

Controllers should only:

- receive request
- validate/parsing handoff
- call service
- return response

Do not place:

- classification logic
- fridge mutation logic
- recommendation logic
- MQTT publish logic
- notification orchestration

inside controllers.

---

### 9.3 Services own business workflows

Use `src/services/` for:

- dish recommendation orchestration
- AI inference flows
- fridge update workflows
- MQTT + push notification coordination
- caching decisions
- multi-step transactional behavior

---

### 9.4 Validation stays explicit

Use `src/validations/` for:

- request schema validation
- body/query/param validation
- preventing controller bloat

Do not bury request validation deep inside services without reason.

---

### 9.5 Utils must stay generic

If logic belongs to one domain only, do not place it in `utils/`.

Examples of logic that should **not** go to `utils/`:

- suggest dishes from fridge contents
- parse ONNX prediction into ingredient domain data
- publish result to MQTT with business topic semantics
- prepare Expo notification payload for ingredient classification result

Those belong to services.

---

### 9.6 Redis is infrastructure, not a business dumping ground

Use Redis for:

- cache
- short-lived state
- temporary helper flows

Do not move business workflows into Redis.

---

### 9.7 MQTT logic must be explicit

MQTT topic structure, publish rules, and device-facing event behavior must be kept explicit and reviewable.

Do not hide MQTT business semantics inside generic helper files.

---

## 10. DEPLOYMENT / RUNTIME COMMANDS

The project uses the following scripts:

```json
{
  "start": "pnpm build && pm2 start ecosystem.config.json --no-daemon",
  "dev": "cross-env NODE_ENV=development nodemon src/index.ts",
  "test": "docker-compose -f docker-compose.only-db-test.yml up -d && pnpm db:push && jest -i --colors --verbose --detectOpenHandles && docker-compose -f docker-compose.only-db-test.yml down",
  "test:watch": "docker-compose -f docker-compose.only-db-test.yml up -d && pnpm db:push && jest -i --watchAll && docker-compose -f docker-compose.only-db-test.yml down",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "prettier": "prettier --check **/*.ts",
  "prettier:fix": "prettier --write **/*.ts",
  "db:push": "prisma db push",
  "db:generate": "prisma generate",
  "db:studio": "prisma studio",
  "docker:prod": "docker-compose -f docker-compose.yml -f docker-compose.prod.yml up",
  "docker:dev": "docker-compose -f docker-compose.yml -f docker-compose.dev.yml up",
  "docker:test": "docker-compose -f docker-compose.yml -f docker-compose.test.yml up",
  "docker:dev-db:start": "docker-compose -f docker-compose.only-db-dev.yml up -d",
  "docker:dev-db:stop": "docker-compose -f docker-compose.only-db-dev.yml down",
  "prepare": "node scripts/prepare.js",
  "build": "rimraf build && tsc -p tsconfig.json",
  "test:redis": "tsx tests/utils/testRedis.ts"
}
```

### Deployment rule

This project is considered **Docker-deployed**.

Preferred runtime and deployment flows should follow the Docker scripts:

```bash
pnpm docker:dev
pnpm docker:prod
pnpm docker:test
```

Do not assume native PM2 deployment is the primary deployment mode, even if `start` exists.

If a task changes:

- environment variables
- container dependencies
- Redis/Postgres/MQTT service assumptions
- build/runtime startup behavior
- Docker compose expectations

then you must update the relevant Docker and environment files, including for example:

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `docker-compose.test.yml`
- `.env.example`
- docs/README if applicable

Do not leave Docker/deployment documentation outdated after backend changes.

---

## 11. TASK EXECUTION RULES

When working on any task, follow this order:

### Step 1 — Identify the owning layer

Before writing code, determine whether the change belongs to:

- config
- constants
- controller
- middleware
- route
- service
- utils
- validation
- prisma/database layer

### Step 2 — Respect current folder architecture

Do not invent a new module structure unless explicitly asked.

### Step 3 — Implement the smallest safe change

Avoid unnecessary rewrites during feature work.

### Step 4 — Keep business logic in services

If a task becomes multi-step, move orchestration into `services/`.

### Step 5 — Run verification commands before considering the task complete

You must run the relevant checks before marking the task done.

---

## 12. REQUIRED VERIFICATION BEFORE TASK COMPLETION

Before completing any backend task, run the appropriate checks.

Minimum required checks:

### Development boot

```bash
pnpm dev
```

### Lint

```bash
pnpm lint
```

### Build

```bash
pnpm build
```

### Prisma schema sync check when database shape changes

```bash
pnpm db:generate
pnpm db:push
```

### Tests

```bash
pnpm test
```

### Redis-specific verification when Redis-related changes are made

```bash
pnpm test:redis
```

### Docker verification when deployment/runtime behavior changes

```bash
pnpm docker:dev
```

Use the relevant Docker command for the environment you changed.

Do not declare the task complete until the relevant checks pass.

---

## 13. DATABASE RULES

This project uses **Prisma** with PostgreSQL.

Use these rules:

- keep schema changes in `prisma/`
- regenerate Prisma client when needed
- do not write raw SQL unless the task explicitly requires it
- keep data modeling changes aligned with real business flows
- if schema changes affect services/controllers/docs, update them too

---

## 14. AI / ONNX RULES

The project contains ONNX-based ingredient classification.

Rules:

- AI model orchestration belongs in services
- prediction parsing should remain reviewable and deterministic
- ONNX runtime integration should not leak into unrelated layers
- keep preprocessing / postprocessing clean and testable
- do not hide inference business semantics inside generic helper files

If image + weight are used together, the orchestration logic should remain explicit.

---

## 15. MQTT RULES

MQTT exists for smart scale / smart device connectivity.

Rules:

- keep MQTT client setup and topic config explicit
- topic names / event contracts should be readable and maintainable
- publishing AI results should happen in service flows, not in controllers directly
- avoid spreading MQTT publish calls everywhere without ownership

---

## 16. REDIS RULES

Redis is used for caching and infrastructure support.

Rules:

- Redis connection/bootstrap belongs in infrastructure/config layer
- domain-specific cache usage should stay close to the owning service
- do not add Redis complexity unless it brings real value
- if caching is added, define invalidation rules clearly

---

## 17.1 MQTT Service Structure — Follow the Existing Pattern

The project already has an MQTT service structure that must be respected.

### Existing MQTT architecture assumptions

The current MQTT implementation already follows a service-style pattern:

- a singleton-like `mqttService` instance is exported
- MQTT connection is established centrally
- reconnect/error/offline/close/disconnect events are already handled
- the service supports:
  - `publish(topic, payload)`
  - `subscribe(topic, handler)`
- handlers are stored in-memory by topic pattern
- wildcard matching is already supported for `+`
- payloads are JSON-stringified before publish
- logging is already part of the MQTT flow

### Important implementation rule

Do **not** redesign MQTT from scratch.

Do **not** introduce a completely different event bus abstraction unless explicitly required.

Instead, follow the existing MQTT service pattern and integrate the recommendation workflow with it.

### What this means for the recommendation job feature

When the async recommendation job finishes, if MQTT publishing is required, the AI must:

- use the existing `mqttService`
- publish via `mqttService.publish(...)`
- keep topic naming explicit and reviewable
- keep business-specific topic selection inside the relevant service workflow
- avoid calling MQTT directly from controllers

### Correct placement

MQTT usage for the recommendation workflow should look like this conceptually:

- controller receives HTTP request
- service creates job
- worker/service processes job
- worker/service publishes MQTT result if required
- MQTT infrastructure remains centralized in the existing MQTT service

### Do not do these things

- do not instantiate a new MQTT client inside controllers
- do not create per-request MQTT connections
- do not hide business MQTT topic decisions inside `utils`
- do not bypass the current `mqttService` pattern

---

## 17.2 MQTT Topic and Payload Guidance for Recommendation Jobs

If the recommendation workflow needs MQTT output, define the topic and payload explicitly.

### Recommended topic style
Use a clear, domain-owned topic naming pattern, for example:

- `smartfood/recommendations/{userId}/completed`
- or another explicit topic pattern already aligned with project conventions

### Recommended payload shape
Keep payloads compact and useful for downstream consumers. Example:

```json
{
  "jobId": 123,
  "userId": 1,
  "status": "SUCCESS",
  "type": "recommendation_ready"
}
```

If a richer MQTT payload is needed, keep it explicit and domain-owned.

Do not publish overly large unnecessary blobs to MQTT unless that is truly needed.

---

## 17.3 Notification Service Structure — Follow Existing Service-Oriented Ownership

Push notification behavior must also follow the existing architecture.

### Notification architecture expectations

Notification sending should remain a **service-layer responsibility**.

It must not live in:
- controllers
- routes
- utils
- prisma models
- Redis bootstrap files

Instead, recommendation workflow code should call a notification-related service from inside the business workflow.

### Expected notification flow for this task

When recommendation processing completes successfully:

1. worker finishes the recommendation job
2. worker updates DB status to `SUCCESS`
3. worker caches final output in Redis
4. worker checks whether the user has a registered Expo Push Token
5. if a token exists, worker triggers a silent/background notification
6. if token does not exist, the job still succeeds

### Important rule

Push notification failure must be **best-effort**, not a hard blocker for the recommendation job.

That means:

- if the recommendation result is generated successfully
- but push notification fails

the job should generally still remain `SUCCESS`, unless product rules explicitly say otherwise.

---

## 17.4 Notification Payload Guidance for Recommendation Jobs

For this feature, use a light notification payload.

Recommended silent/background-style payload idea:

```json
{
  "type": "recommendation_ready",
  "jobId": 123,
  "userId": 1
}
```

If the notification service already has its own payload contract, follow that existing structure instead of inventing a new incompatible one.

### Notification content rules
- keep payload small
- avoid embedding the full recommendation result into the push payload
- let the mobile app fetch the result using `GET /recommendations/:jobId`

That is cleaner and more scalable.

---

## 17.5 Recommendation Workflow Integration Rule

The async recommendation job workflow must integrate with MQTT and notifications in this order:

1. build full recommendation input
2. create DB job with `PENDING`
3. enqueue job
4. worker starts processing and sets `PROCESSING`
5. worker generates mock AI result
6. worker updates DB with `SUCCESS` and final output
7. worker caches final output in Redis for 7 days
8. worker publishes MQTT event if required
9. worker triggers push notification if token exists

If any post-processing side effect fails:

- MQTT publish failure should be logged and handled appropriately
- push failure should be logged and handled appropriately
- these side effects should not unnecessarily corrupt the final recommendation result if the result itself is valid

---

## 17.6 Logging Expectations

Because the existing MQTT service already uses structured logging patterns, follow the same idea for recommendation side effects.

At minimum, log clearly when:

- recommendation job is created
- job is enqueued
- worker starts processing
- worker finishes successfully
- Redis cache write succeeds/fails
- MQTT publish succeeds/fails
- push notification succeeds/fails

Do not swallow side-effect failures silently.

---

## 17.7 Keep Service Boundaries Clean

For the recommendation feature, the AI must keep these responsibilities separated:

### Controller
- validate request
- call service
- return `jobId`

### Recommendation service / worker service
- build full AI input
- create job
- enqueue job
- process job
- save result
- cache result
- trigger MQTT publish
- trigger push notification

### MQTT service
- manage MQTT connection lifecycle
- publish and subscribe
- handler registration
- topic matching

### Notification service
- send Expo push payloads
- manage notification transport details

### Redis infrastructure
- queue/cache support
- connection/bootstrap
- TTL handling

Do not collapse these layers together.

## 18. DEFINITION OF DONE

A backend task is considered done only when all of the following are satisfied:

- the change is implemented in the correct folder/layer
- the current structure is respected
- no unnecessary destructive refactor was introduced
- business logic is placed in the correct service/controller/config boundary
- Prisma/database changes are consistent
- Redis/MQTT/AI integrations remain clear and maintainable
- relevant scripts pass
- runtime behavior is not broken
- Docker/deployment files are updated if needed
- docs/config/scripts are updated if needed

---

## 19. EXPECTED AI BEHAVIOR

When given a task, the AI must:

1. inspect the current structure
2. identify the correct owning layer/folder
3. implement the smallest correct change
4. keep controller thin and service-focused
5. avoid unnecessary rewrites
6. run relevant verification commands
7. update Docker/docs/config if task scope requires it

---

## 20. NOTES FOR FUTURE TASKS

This overview is intended to guide future tasks such as:

- auth improvement
- cookbook / dish APIs
- ingredient and nutrition lookup
- ONNX inference integration
- smart suggestion logic
- virtual fridge flows
- fridge change log features
- Redis caching improvements
- MQTT connectivity enhancements
- Expo notification workflows
- Prisma/database updates
- debugging and production hardening

Do not use this overview as permission to rebuild the backend architecture from zero.
Use it as a guide for **safe, structure-aware, service-oriented backend work**.
