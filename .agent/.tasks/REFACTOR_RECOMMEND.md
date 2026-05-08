# Smart Food Backend – Recommendation Feature Update Prompt

## Project Context
- **Backend Stack:** Node.js + TypeScript + Express.js  
- **Database & ORM:** PostgreSQL + Prisma  
- **Cache & Messaging:** Redis + MQTT  
- **AI/ML:** ONNX Runtime  
- **Notifications:** Expo Push Notifications  
- **Existing Recommendation APIs:**  
  - `POST /recommendations`  
  - `GET /recommendations/:jobId`  

The backend is organized in **layered technical folders** (`src/config/`, `src/controllers/`, `src/services/`, `src/models/`, `src/routes/`, `src/utils/`, `src/validations/`). Controllers must remain thin; business logic belongs in services.

---

## Tasks for AI

### 1. Add `GET /recommendations/`
- New endpoint to **return all recommendation jobs** for the authenticated user (use bearer token).  
- Must integrate with existing authentication.  
- Controller should orchestrate only; call service for all logic.  
- Response should include job metadata (`jobId`, `status`, `createdAt`, etc.).

---

### 2. Update POST `/recommendations` flow
- Request may include:
```ts
lockedPicks: ChangeDish[]
```
where each item has the shape:
``` ts
{
  day: number;
  meal: MealType;
  role: DishType;
  dishId: number;
}
```
- If lockedPicks has values:
    Backend must replan the existing job, discarding previous calculation results.
- If lockedPicks is empty or not provided:
    Backend must create a new recommendation job with a full calculation.
- All orchestration logic must reside in service layer, controller only validates input and calls service.
### 3. Use environment variables
- `RECOMMENDATION_SYSTEM_URL`: external recommendation API endpoint  
- `USE_MOCK_DATA` (`true` or `false`):  
  - `true` → use mock data  
  - `false` → call external API  
- Logic for switching between mock and real API must be implemented in the **service layer**.  
- Configuration values should be injected from `src/config` and used consistently across services.  
- The service should respect the following behavior:  
  - If `USE_MOCK_DATA` is `true`, generate or return mock recommendation results.  
  - If `USE_MOCK_DATA` is `false`, call the external API at `RECOMMENDATION_SYSTEM_URL` and process the real response.  
- Ensure all calls respect error handling and timeout policies; failures in external API should be logged but should not crash the backend.  
### 4. Check and merge TypeScript interfaces
- Inspect `modals/interfaces` for **duplicate type/interface declarations**.  
- Merge duplicates to maintain **type consistency** across the backend.  
- Avoid creating conflicting types; reuse existing interfaces whenever possible.  
- Ensure that merged interfaces are correctly imported wherever they are used in services, controllers, or validations.  
- Update or refactor only if necessary, keeping **backward compatibility** for existing code.

---

### 5. Coding principles
- **Keep controllers thin** – they should only orchestrate requests, validate input, and call services.  
- **Services** handle all business logic, including:  
  - Recommendation orchestration  
  - Replanning jobs based on `lockedPicks`  
  - Mock/real API handling using environment variables  
  - Redis caching (job/result TTL management)  
  - Optional MQTT publish & push notifications  
- Redis should be used **intentionally and sparingly** for caching only.  
- Follow existing MQTT service and notification flow patterns; **do not create new clients in controllers**.  
- Prisma schema should **not be modified unnecessarily**; if schema changes are made → run `pnpm db:push` + `pnpm db:generate`.  
- Write **unit and integration tests** covering:  
  - Replan flow with `lockedPicks` values  
  - New job creation when `lockedPicks` is empty  
  - Mock vs real API switching  
  - Redis caching behavior  
  - Optional MQTT and push notification triggers  
  ### 6. New Task: Add `POST /users/clear-cache`
- Endpoint to **clear all Redis cache** for the user or global cache depending on backend design.  
- Must be **authenticated** (bearer token).  
- Controller should call a service that interacts with Redis.  
- Service should:  
  - Flush all relevant Redis keys or database-backed cache  
  - Log the cache clear operation  
  - Return a success/failure response  
- Write tests to confirm that cache is properly cleared and no residual data remains.  

---

### 7. Deliverables
- Controller updates for `POST /recommendations`, `GET /recommendations/`, and `POST /users/clear-cache`  
- Service updates for replan logic, mock/real API switching, and cache clearing  
- Route registration for new GET and POST endpoints  
- Config updates to read `RECOMMENDATION_SYSTEM_URL` and `USE_MOCK_DATA`  
- Redis caching integration if necessary  
- Merged TypeScript interfaces to remove duplicates  
- Tests for all updated flows  

---

### 8. Verification
Before marking task complete, run:
```bash
pnpm dev
pnpm lint
pnpm build
```
### 9. Additional Notes
- Respect existing folder structure; do not refactor backend architecture unnecessarily.
- Keep service boundaries clean: controllers → services → Redis/MQTT/notifications.
- Maintain logs for job creation, processing, caching, MQTT publish, and push notification events.