# Task — Implement Recommendation Job APIs with Queue, DB Persistence, Redis Cache, Mock AI Worker, and Push Notification

**Task Type:** Backend Feature Implementation / Async Job Workflow
**Priority:** High
**Source of Truth:** `OVERVIEW.md` for SMART-FOOD-BE + provided AI input/output sample
**Project:** SMART-FOOD-BE
**Stack:** Node.js, TypeScript, Express.js, Prisma, PostgreSQL, Redis
**Status:** Todo

---

## 1. Context

This backend already follows a layered structure:

- `controllers/` for HTTP orchestration
- `routes/` for route mounting
- `services/` for business workflows
- `validations/` for request validation
- `config/`, `constants/`, `utils/`, `redis.ts` for infrastructure/shared helpers

You must **respect the existing structure** and implement this feature incrementally.

Do **not** rewrite the backend into a new architecture.

This task introduces an **async recommendation workflow** using:

- HTTP API
- database job persistence
- queue/dequeue flow
- Redis caching
- mock AI result generation
- push notification after completion

---

## 2. Feature Goal

Implement **2 APIs** for smart meal recommendation jobs:

### API 1 — `POST /recommendations`

Purpose:

- client submits a recommendation request
- backend creates a job
- backend stores request metadata in DB
- backend enqueues the job
- backend returns `jobId` immediately
- worker processes the job asynchronously
- worker stores output in DB
- worker caches output in Redis for 7 days
- worker sends a silent/background push notification to the user’s phone

### API 2 — `GET /recommendations/:jobId`

Purpose:

- client polls job status/result by `jobId`
- backend returns:
  - current status
  - input
  - output if finished
  - metadata fields if relevant

---

## 3. Required Product Flow

### POST flow

1. Client sends minimal request:

   - `userId`
   - `planDays`
   - `startDate`
   - `mealStructure`
   - `goal`

2. Backend uses `userId` to query additional inputs from the system, such as:

   - fridge data
   - recent meal log
   - user's age, weight, height
   - caculate TDEE with true formula

3. Backend builds the full AI input payload

4. Backend stores a recommendation job row in DB with:

   - generated job id
   - user id
   - status
   - input JSON
   - output JSON = null initially
   - timestamps

5. Backend enqueues the job

6. Backend immediately returns the created `jobId`

7. Background worker dequeues the job

8. Worker calls the external AI model

   - but for now **do not call a real AI model**
   - use **mock output data** based on the provided sample

9. Worker updates job status and saves output to DB

10. Worker stores final output in Redis for **7 days**

11. Worker sends a silent/background push notification to the user’s phone if an Expo Push Token exists

---

### GET flow

1. Client calls `GET /recommendations/:jobId`
2. Backend checks Redis cache first if appropriate
3. If cache miss, read from DB
4. Return job status and result to client

---

## 4. API Contracts

## 4.1 POST `/recommendations`

### Request body

The incoming request body should minimally accept:

```json
{
  "userId": 1,
  "planDays": 5,
  "startDate": "2026-04-21T00:00:00.000Z",
  "mealStructure": {
    "breakfast": {
      "mainDish": 1,
      "soup": 0,
      "vegetable": 1
    },
    "lunch": {
      "mainDish": 1,
      "soup": 1,
      "vegetable": 1
    },
    "dinner": {
      "mainDish": 1,
      "soup": 1,
      "vegetable": 1
    }
  },
  "goal": {
    "targetKg": -0.5
  }
}
```

### Important rule

Do **not** require the client to send full AI input such as:

- `fridge`
- `recentMealLog`
- `tdee`
- `weight`

Those should be resolved server-side using `userId`, when available in the system.

### POST response

Return immediately after job creation:

```json
{
  "jobId": 123,
  "status": "PENDING"
}
```

---

## 4.2 GET `/recommendations/:jobId`

### Response shape

Return a job-centric payload such as:

```json
{
  "jobId": 123,
  "status": "SUCCESS",
  "userId": 1,
  "input": { ... },
  "output": { ... },
  "createdAt": "2026-04-27T04:20:00.000Z",
  "updatedAt": "2026-04-27T04:21:10.000Z"
}
```

If the job is not done yet:

```json
{
  "jobId": 123,
  "status": "PROCESSING",
  "userId": 1,
  "input": { ... },
  "output": null
}
```

If not found, return appropriate 404 response.

---

## 5. Input / Output Model Requirements

Use the provided AI sample as the source of truth for shape.

### Full AI input payload shape

The full worker-side payload should match the provided sample pattern, including fields like:

- `userId`
- `tdee`
- `weight`
- `goal`
- `mealStructure`
- `planDays`
- `startDate`
- `recentMealLog`
- `fridge`

The sample shows that the input contains structured meal preferences and fridge inventory data. :contentReference[oaicite:1]{index=1}

### AI output payload shape

The worker result should match the provided sample pattern, including:

- `status`
- `plan`
- `summary`
- `shoppingList`

The sample output includes daily meal planning with:

- `day`
- `date`
- `meals`
- `nutrition`

and summary/shopping list data. :contentReference[oaicite:2]{index=2}

### Existing persisted type

You already provided this persisted type shape:

```ts
export interface IRecommend {
  id: number;
  status: RecommendationStatus;
  userId: number;
  input: JSON;
  output: JSON;
  createdAt: Date;
}
```

That means DB persistence should remain job-oriented and JSON-based for input/output. :contentReference[oaicite:3]{index=3}

---

## 6. Job Status Requirements

Implement a clear recommendation job status lifecycle.

Recommended statuses:

- `PENDING`
- `PROCESSING`
- `SUCCESS`
- `FAILED`

Rules:

- `PENDING` when the job is created and queued
- `PROCESSING` when a worker starts handling it
- `SUCCESS` when output is stored successfully
- `FAILED` when mock/worker flow throws an error

Do not use vague status names.

---

## 7. Architecture Rules

### 7.1 Controllers stay thin

Controllers should:

- validate request
- call service
- return response

Do not place:

- queue logic
- AI input composition
- mock AI generation
- Redis caching logic
- push notification logic

inside controllers.

### 7.2 Services own the workflow

Services should own:

- building full input from `userId`
- creating recommendation jobs
- queue enqueue/dequeue
- worker processing
- mock AI output generation
- DB update after completion
- Redis caching
- push notification sending

### 7.3 Validation stays explicit

Put request validation inside `validations/`.

### 7.4 Redis remains infrastructure

Use Redis for:

- queue backend if needed
- output cache
- temporary job state if useful

Do not push business logic into `redis.ts`.

### 7.5 Keep mock AI logic isolated

Since the real external AI model is not ready yet, implement mock generation in a clearly isolated service/module.

Do not pretend it is the real AI integration.

---

## 8. Recommended File Ownership

Follow the current project structure and place code like this:

### `routes/`

Add recommendation routes.

### `controllers/`

Add a recommendation controller with:

- `createRecommendationJob`
- `getRecommendationJobById`

### `validations/`

Add validation schemas for:

- POST body
- GET params

### `services/`

Add recommendation business modules such as:

- job creation service
- input hydration service
- queue service
- worker processor service
- mock AI adapter service
- cache service helper if needed
- push notification trigger service if needed

### `constants/`

Add recommendation job statuses and any fixed queue/cache key names.

### `config/`

Only if needed for queue/Redis/push config.

### `utils/`

Only for truly generic helpers, not recommendation business logic.

---

## 9. Recommended Implementation Strategy

### Step 1 — Define types and statuses

Create TypeScript types/interfaces for:

- POST request payload
- full worker input payload
- worker output payload
- job response payload
- recommendation status enum

Use the provided sample input/output shape as the model. :contentReference[oaicite:4]{index=4}

---

### Step 2 — Add DB model support

Add or update the Prisma model for recommendation jobs.

The stored record should include at least:

- `id`
- `userId`
- `status`
- `input`
- `output`
- `createdAt`
- `updatedAt`

If the project already has a recommendation table/model, extend it carefully instead of recreating everything.

---

### Step 3 — Add POST validation

Validate:

- `userId`
- `planDays`
- `startDate`
- `mealStructure`
- `goal`

Do not trust client input.

---

### Step 4 — Build full worker input from `userId`

Implement a service that fetches or derives:

- fridge data
- recent meal log
- nutrition/TDEE/weight if available
- any other needed input data

If some data is not yet available in the current system, fill it with documented mock/default behavior for now, but do so explicitly.

Do not hardcode random values without explanation.

---

### Step 5 — Create job record

When POST is called:

- save DB record with `PENDING`
- save fully-built `input`
- save `output = null`

Return the `jobId` immediately.

---

### Step 6 — Enqueue job

Use a Redis-backed queue approach suitable for the current Node.js backend.

Recommended:

- BullMQ or another Redis-backed job queue

If Redis is already connected centrally, integrate cleanly with the existing Redis setup instead of creating duplicated connection code.

---

### Step 7 — Process job asynchronously

Worker flow:

- set job status to `PROCESSING`
- call mock AI service
- receive mock result
- update DB with `SUCCESS` and `output`
- cache result in Redis for 7 days
- send silent push notification

If error:

- set job status to `FAILED`
- preserve input
- store a safe error field if your schema supports it

---

### Step 8 — Mock external AI result

Since the real AI service is not ready, return a deterministic mock result based on the provided sample output structure.

Important:

- do not return meaningless placeholder comments
- do not return malformed JSON
- the mock output must match the real expected output shape as closely as possible
- use the sample structure for `plan`, `summary`, and `shoppingList` :contentReference[oaicite:5]{index=5}

---

### Step 9 — Cache final result in Redis for 7 days

When the job completes successfully:

- cache by job id
- TTL = 7 days

Recommended cache key pattern:

- `recommendation:job:<jobId>`

On `GET /recommendations/:jobId`:

- try Redis first
- fallback to DB if not found
- optionally rehydrate Redis on DB hit

---

### Step 10 — Send silent push notification

After success:

- look up user Expo Push Token
- if token exists, send a silent/background-style notification
- if token does not exist, do not fail the job because of that

Push notification must be best-effort, not critical-path job failure unless your product rules explicitly require otherwise.

---

### Step 11 — Implement GET by jobId

Add:

- param validation
- Redis read path
- DB fallback path
- correct 404 handling
- stable response contract

---

## 10. Error Handling Rules

### POST errors

Return proper validation errors for invalid request body.

### Worker errors

If the job fails during processing:

- mark job `FAILED`
- do not leave it stuck at `PENDING` or `PROCESSING`

### GET errors

If job not found:

- return 404

If Redis is unavailable but DB works:

- still return DB result if possible
- do not hard-fail unnecessarily

### Push notification failures

Do not mark the recommendation job as failed solely because the push notification failed, unless business requirements explicitly say otherwise.

---

## 11. Caching Rules

### What to cache

Cache only the **final successful job result**.

### TTL

- 7 days

### Cache key

Recommended:

- `recommendation:job:<jobId>`

### Invalidation

Because this is a job result snapshot, natural TTL expiration is acceptable.
Do not overcomplicate invalidation unless the product later requires regeneration/versioning.

---

## 12. Suggested Endpoint Design

### POST

- `POST /recommendations`

### GET

- `GET /recommendations/:jobId`

Keep route naming simple and REST-like.

---

## 13. Acceptance Criteria

This task is complete only if:

- `POST /recommendations` creates a job and returns `jobId` immediately
- the job is persisted in DB
- a queue/dequeue flow exists
- async worker processing updates status correctly
- the worker uses mock AI output for now
- successful result is saved to DB
- successful result is cached in Redis for 7 days
- silent/background push notification is attempted after success
- `GET /recommendations/:jobId` returns current job state/result
- controllers remain thin
- business logic stays in services
- validations are explicit
- `pnpm lint` passes
- `pnpm build` passes
- relevant DB/Redis verification passes

---

## 14. Definition of Done

This task is done only when:

- both APIs are implemented and usable
- the async recommendation workflow is functioning end-to-end
- DB persistence is correct
- Redis caching works
- job status transitions are correct
- mock AI output matches the expected shape closely
- push notification integration is included in the workflow
- the implementation follows the existing project structure
- no unnecessary architecture rewrite was introduced

---

## 15. Required Commands

Run the relevant commands before considering the task complete.

### Lint

```bash
pnpm lint
```

### Build

```bash
pnpm build
```

### Development runtime

```bash
pnpm dev
```



## 16. Notes for Implementation

- Follow the existing structure strictly.
- Keep controllers thin and move business workflow into services.
- Use Redis-backed queueing cleanly.
- Keep the real AI integration mocked for now.
- Use the provided sample input/output as the contract model. :contentReference[oaicite:6]{index=6}
- Do not require the frontend to send the full AI input payload if the backend can derive it from `userId`.
- Keep the implementation reviewable and production-oriented, even if AI output is currently mocked.
