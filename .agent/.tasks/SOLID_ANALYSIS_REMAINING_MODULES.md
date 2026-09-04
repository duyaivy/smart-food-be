# Phân tích SOLID — Các module còn lại (ngoài Auth, Dish, Notification, Fridge)

> **Phạm vi:** Đã đọc toàn bộ code thuộc các module **Category, Ingredient, IoT, Meal, Nutrition, Recommendation, Upload, User** và các service hỗ trợ (**Token, Email, MQTT, IngredientClassification, ContentNotification**) + các `utils` liên quan.
>
> **Đã loại trừ:** `auth`, `dish`, `notification`, `fridge` (đã được kiểm tra trước đó).
>
> **Ngày phân tích:** 2026-08-26
>
> **Kết luận ngắn:** Controllers hầu hết đều mỏng và ổn. Vi phạm SOLID nặng nhất nằm ở **`iot.service.ts`** (God object), **`recommendation.service.ts`** (God object + mock template khổng lồ), **`recommendation.queue.service.ts`** (worker + cache + notification trộn lẫn), và **`user.service.ts` / `user.controller.ts`** (nhiều trách nhiệm không liên quan). Các module Category, Upload, Token, Email, MQTT, IngredientClassification, IngredientClass đạt chuẩn SOLID tốt.

---

## 1. Bảng tổng hợp vi phạm theo module

| Module | SRP | OCP | LSP | ISP | DIP | Mức độ |
|---|---|---|---|---|---|---|
| Category | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 Sạch |
| Upload | ✅ | ✅ | ⚠️ | ✅ | ✅ | 🟢 Sạch (typing lỏng) |
| Token / Email / MQTT / IngredientClassification / ContentNotification | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 Sạch |
| Ingredient | ⚠️ | ✅ | ✅ | ✅ | ❌ | 🟠 Trung bình |
| Nutrition | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | 🟠 Trung bình |
| Meal | ⚠️ | ⚠️ | ✅ | ✅ | ❌ | 🟠 Trung bình |
| User | ❌ | ⚠️ | ❌ | ❌ | ⚠️ | 🔴 Cao |
| Recommendation (service + queue) | ❌ | ❌ | ⚠️ | ❌ | ❌ | 🔴 Cao |
| IoT | ❌ | ❌ | ⚠️ | ❌ | ❌ | 🔴 Cao |

---

## 2. Phân tích chi tiết theo module

### 2.1. IoT — `iot.service.ts` (🔴 Nghiêm trọng nhất)

**File:** `src/services/iot.service.ts` (594 dòng), `src/controllers/iot.controller.ts`, `src/routes/v1/iot.route.ts`

**Trách nhiệm hiện tại của 1 service duy nhất:**
- Quản lý queue xử lý scan (`scanJobQueue`, `activeScanJobs`, dòng 57–67, 276–319)
- Upload ảnh lên Cloudinary (dòng 96–139)
- Publish MQTT kết quả scan (dòng 141–149)
- SSE streaming tới client (dòng 29, 69–94, 406–439)
- Điều phối AI inference ONNX (dòng 151–274, gọi `ingredientClassifierService`)
- Lưu/đọc Redis heartbeat + trạng thái online (dòng 321–346, 498–552)
- CRUD device: pair / unpair / getMyDevices (dòng 441–583)

**Vi phạm:**

| Nguyên tắc | Mô tả |
|---|---|
| **SRP** | Một file phục vụ **6+ trách nhiệm** không liên quan nhau: queue, upload, MQTT, SSE, AI orchestration, device CRUD, Redis heartbeat. Bất kỳ thay đổi nào về thiết bị (pair/unpair) đều buộc đọc lại toàn bộ logic scan/queue. |
| **OCP** | `executeScanJob` (dòng 151–274) là một chuỗi monolithic: nếu muốn thêm bước xử lý mới (ví dụ: kiểm tra hạn sử dụng, ghi log scan vào DB) phải sửa hàm gốc → không mở cho việc mở rộng. |
| **DIP** | Service phụ thuộc trực tiếp vào các singleton cụ thể: `mqttService`, `ingredientClassifierService`, `cloudinary`, `prisma`, `redis`, `logger` (dòng 5–11). Không thể test với mock, không thể thay adapter khác. |
| **ISP** | HTTP controller (`iot.controller.ts`) import toàn bộ service và lấy cả 6 method, dù thực tế scan/stream không dùng tới device CRUD. |
| Phụ | **Side effect khi load module:** `mqttService.subscribe(...)` chạy ngay ở module scope (dòng 369). **State toàn cục mutable:** `sseClients`, `scanJobQueue` ở module scope → khó test, khó scale multi-instance (queue chạy trong memory của từng instance). |

**Đề xuất chỉnh sửa:**
- Tách thành các service nhỏ, mỗi cái 1 trách nhiệm, theo đúng pattern `fridge.service` / `fridgeInventory.service` / `fridgeTransaction.service` đã làm:
  - `iot.scanQueue.service.ts` — queue + concurrency
  - `iot.scanProcessor.service.ts` — orchestrates AI predict → nutrition → publish (chấp nhận các dependency qua interface)
  - `iot.mqttPublisher.service.ts` — publish + heartbeat subscribe
  - `iot.sse.service.ts` — SSE client registry
  - `iot.device.service.ts` — pair/unpair/getMyDevices/getDeviceStatus (hiện đã tách biệt rõ về mặt nội dung, chỉ cần move)
  - `iot.cloudinaryUpload.service.ts` — hoặc tái sử dụng `upload.service.ts`
- Đưa config queue (concurrency, TTL) lên `src/config` thay vì hardcode trong file.
- Tránh side effect ở module scope: gọi `mqttService.subscribe` trong một hàm `init()` gọi từ `src/index.ts`.

---

### 2.2. Recommendation — `recommendation.service.ts` (🔴 Nghiêm trọng)

**File:** `src/services/recommendation.service.ts` (723 dòng), `recommendation.queue.service.ts` (324 dòng), `recommendation.inputHydration.service.ts`, controller, route, validation, interface.

**Vi phạm:**

| Nguyên tắc | Mô tả |
|---|---|
| **SRP** | Một service chịu: tạo job + persist DB + cache Redis + gọi API AI (mock/real) + tìm món thay thế (`getSubRecommendations`) + cập nhật kế hoạch (`updateRecommendation` với transaction 130 dòng) + rebuild shopping list + tính dinh dưỡng. Rõ ràng đây là "God object". |
| **OCP** | `generateRecommendation` (dòng 288–335) chứa nhánh mock/real inline — muốn thêm provider AI khác phải sửa hàm. Mock template `RECOMMENDATION_OUTPUT_TEMPLATE` (dòng 24–125, ~100 dòng data cứng) nằm ngay trong service → trộn data + logic. |
| **ISP** | Service expose 6 method rất khác nhau (tạo job, đọc job, sinh AI, tìm sub, update plan) qua 1 interface → consumer phụ thuộc thừa. |
| **DIP** | Import trực tiếp `prisma`, `redis`, `recommendationInputHydrationService`, `enqueueRecommendationJob` (dòng 3–22). |
| **LSP/type** | Dùng `any` tràn lan: `getMissingIngredients(... any[])`, `rebuildShoppingList(... any[])`, `getSubRecommendations` trả `any[]`, `updateRecommendation` cast `output as any`. Phá vỡ toàn bộ type contract đã khai báo trong `recommendation.interface.ts` → dễ gây runtime error không kiểm soát. |
| **Circular dependency** | `recommendation.service` import `enqueueRecommendationJob` từ `recommendation.queue.service`, **đồng thời** `recommendation.queue.service` import `recommendationService.generateRecommendation` (queue.service dòng 14, 156) → **circular dependency** giữa 2 file. |

**Vi phạm riêng trong `recommendation.queue.service.ts`:**

| Nguyên tắc | Mô tả |
|---|---|
| **SRP** | Hàm `initRecommendationWorker` (dòng 79–323) làm tất cả: khởi tạo BullMQ, đọc job, cập nhật status DB, gọi AI, ghi cache Redis, gửi push notification, xử lý event `failed`. Worker callback + event handlers + DB + cache + notification trộn trong 1 hàm dài. |
| **OCP** | Muốn thêm bước xử lý (VD: gửi MQTT sau khi xong, retry policy riêng) phải sửa nguyên hàm worker. |
| **DIP** | Import trực tiếp `notificationService`, `recommendationService`, `prisma`, `redis`, `logger`. |

**Đề xuất chỉnh sửa:**
- **Tách theo trách nhiệm** (giữ nguyên đúng hướng `REFACTOR_RECOMMEND.md` đã vạch):
  - `recommendation.job.service.ts` — create/get/update job (DB + cache)
  - `recommendation.aiAdapter.service.ts` (hoặc giữ `generateRecommendation` riêng) — chọn mock/real provider; đưa `RECOMMENDATION_OUTPUT_TEMPLATE` vào `recommendation.mockData.ts` hoặc `recommendation.mockAdapter.service.ts`
  - `recommendation.sub.service.ts` — `getSubRecommendations` (search món thay thế)
  - `recommendation.nutrition.service.ts` — `calculateDishesNutrition`, `rebuildShoppingList`
  - `recommendation.worker.service.ts` — tách handler xử lý job ra khỏi việc khởi tạo queue (queue/service tách biệt, inject qua tham số)
- **Phá vòng dependency:** worker không được import `recommendation.service`; thay vào đó inject `generateRecommendation` vào worker qua constructor/param (đúng DIP).
- **Loại bỏ `any`:** thay bằng type `IMealDish`, `IPlanDay`, `IRecommendationOutput` đã có trong interface.

---

### 2.3. User — `user.service.ts` + `user.controller.ts` (🔴 Cao)

**File:** `src/services/user.service.ts` (288 dòng), `src/controllers/user.controller.ts` (121 dòng), `src/routes/v1/user.route.ts`.

**Vi phạm:**

| Nguyên tắc | Mô tả |
|---|---|
| **SRP** | `user.service.ts` gộp 3 mảng trách nhiệm: (1) CRUD user + profile, (2) push token, (3) **xóa toàn bộ cache hệ thống** (`clearGlobalCache` → `redis.flushall()`, dòng 269–274). Xóa cache là infra concern không thuộc user domain, đặt ở đây rất nguy hiểm. |
| **LSP** | Cùng khái niệm "lấy user" nhưng contract không nhất quán: `getUserById` trả `Pick<User, Key> | null` (generics, mặc định có `password`), còn `getMe` trả `IUser` không password. Controller `getUsers` trả array thô, trong khi mọi list endpoint khác (`ingredients`, `meal history`) trả `{ control, results }`. → Hai consumer gọi 2 hàm "giống nhau" nhận 2 shape khác nhau. |
| **ISP** | Controller (và route) phụ thuộc vào 1 facade `userService` có 10 method trải khắp các domain khác nhau (user, token, cache). |
| Phụ | **Response format không nhất quán trong controller:** `createUser`/`getUsers`/`getUser`/`updateUser` trả raw `res.send(user)` (dòng 23, 30, 38, 43), còn `getMe`/`updateMe`/`createPushToken`/`clearCache` dùng `successResponse` (dòng 54, 64, 77, 101). Frontend sẽ khó xử lý. |
| Phụ | `sendTestNotification` (controller dòng 84–98) gọi thẳng `notificationService` từ controller — vi phạm nguyên tắc "controller mỏng, service trung gian". `clearCache` cũng vậy. |
| Phụ | `clearGlobalCache` dùng `console.log` thay vì `logger` (dòng 272). |

**Đề xuất chỉnh sửa:**
- Tách `user.service.ts` thành: `user.service.ts` (CRUD/profile), `pushToken.service.ts`, và 1 `cache.service.ts` (hoặc dùng `utils/cache.ts` sẵn có) cho `clearCache`; `clearGlobalCache` nên đổi từ `flushall()` sang xóa theo prefix để an toàn.
- Controller `sendTestNotification`/`clearCache` nên đi qua một service trung gian (VD `system.service.ts`) hoặc chuyển sang admin controller riêng.
- Thống nhất response format: mọi endpoint user trả qua `successResponse`.
- Thống nhất model: `getMe`/`updateMe` dùng chung `IUser` contract với `getUserById`; thêm pagination `{control, results}` cho `getUsers` nếu cần.

---

### 2.4. Meal — `meal.service.ts` (🟠 Trung bình)

**File:** `src/services/meal.service.ts` (565 dòng), `src/controllers/meal.controller.ts`, route, validation.

**Vi phạm:**

| Nguyên tắc | Mô tả |
|---|---|
| **DIP** | Service import trực tiếp `fridgeInventoryService` (dòng 5) — module Meal phụ thuộc trực tiếp vào module Fridge (module khác đã được kiểm tra riêng). Muốn đổi nguồn inventory phải sửa meal service. |
| **OCP** | `createMeal` (dòng 470–476) phân nhánh `if (payload.dishId)` → hai luồng `createMealFromExistingDish` / `createCustomMeal`. Muốn thêm kiểu bữa ăn thứ 3 phải sửa hàm dispatcher + thêm hàm. |
| **SRP (nhẹ)** | `meal.service.ts` gộp: đọc dish, đọc ingredient, build snapshot + kiểm tra tồn kho, tính dinh dưỡng, transaction, gọi fridge. Nặng nhưng chấp nhận được. |
| Phụ | **Trùng lặp code lớn** giữa `createMealFromExistingDish` (dòng 278–376) và `createCustomMeal` (dòng 378–468): cùng `getFridgeContext` → `buildSnapshotsByAvailableQuantity` → `create mealLog` → `deductFridgeItems` → `getMealHistoryById`. ~2/3 logic giống hệt nhau. |

**Đề xuất chỉnh sửa:**
- Tách chung phần "tạo meal log + trừ kho" thành 1 hàm dùng chung cho cả 2 luồng (tham số hóa: `dishId` hoặc `customName`, `tag`, ingredients nguồn).
- Bơm `fridgeInventoryService` qua interface (port) hoặc đưa hàm `getFridgeContext`/`deductFridgeItems` về 1 service trung gian về inventory để meal không phụ thuộc trực tiếp vào fridge module.
- Nếu có nhiều loại meal sau này, cân nhắc strategy pattern cho `createMeal`.

---

### 2.5. Nutrition — `nutrition.service.ts` (🟠 Trung bình)

**File:** `src/services/nutrition.service.ts` (209 dòng).

**Vi phạm:**

| Nguyên tắc | Mô tả |
|---|---|
| **SRP (nhẹ)** | `getDailyRemainingNutrition` (dòng 155–202) trực tiếp query `prisma.user` + tính TDEE + target — lẫn trách nhiệm "tra cứu user/body metrics" vào service dinh dưỡng. Nên ủy thác cho user domain. |
| **DIP** | Phụ thuộc trực tiếp `prisma`, `ApiError`; không có port để thay nguồn dữ liệu. |
| Phụ | `getDailyNutrition` được gọi trong `getDailyRemainingNutrition` (dòng 160) — nội bộ ổn, không lỗi. |

**Nhận xét:** Đây là service sạch nhất trong nhóm có vấn đề. Tính năng "thêm macro" (`addNutritionMacro`) và "map mealLog" đã tách hàm riêng tốt.

**Đề xuất chỉnh sửa:**
- Tách hàm query user + TDEE ra một `userMetric.service.ts` hoặc bơm qua tham số để nutrition chỉ lo việc cộng/trừ dinh dưỡng.

---

### 2.6. Ingredient — `ingredient.service.ts` (🟠 Trung bình)

**File:** `src/services/ingredient.service.ts` (168 dòng).

**Vi phạm:**

| Nguyên tắc | Mô tả |
|---|---|
| **DIP** | Service import trực tiếp `contentNotificationService` (dòng 15, 44, 67, 135) và `cache` util (dòng 3). Đây là các dependency cụ thể, không qua interface → khó test/khó thay. |
| **SRP (nhẹ)** | Trộn CRUD + invalidation cache + gửi thông báo content vào cùng service. Chấp nhận được nếu coi như "use case orchestration" nhưng nên tách `cache` concern ra. |

**Nhận xét:** Controllers mỏng ✅, cache key deterministic (`buildListCacheKey`) ✅, soft-delete rõ ràng ✅.

**Đề xuất chỉnh sửa:**
- Giữ nguyên nhưng inject `contentNotificationService` và cache qua tham số/interface nếu muốn test sạch. Việc tách không khẩn cấp.

---

### 2.7. Category — `category.service.ts` (🟢 Sạch)

**File:** `src/services/category.service.ts` (87 dòng), controller, route.

**Nhận xét:** 
- Controller mỏng, đúng chuẩn ✅
- Service chỉ lo category, tách hàm `ensureActiveCategoryExists`, `getCategoryByIdOrThrow` gọn gàng ✅
- Không vi phạm SOLID nào đáng kể.

**Lưu ý nhỏ:** Route đăng ký category 2 lần — một lần trong `routes/v1/index.ts` (dòng 46) và một lần riêng ở `app.ts` dòng 80 (`/api/categories`). Nên gom lại 1 chỗ để tránh nhầm lẫn.

---

### 2.8. Upload — `upload.controller.ts` + `upload.service.ts` (🟢 Sạch, typing lỏng)

**File:** `src/services/upload.service.ts`, `src/controllers/upload.controller.ts`, `src/middlewares/upload.ts`.

**Nhận xét:**
- Service 1 trách nhiệm (Cloudinary) ✅; middleware tách file filter ✅; controller mỏng ✅.

**Điểm yếu (LSP/typing):**
- `uploadToCloudinary` trả `Promise<unknown>`, controller phải cast `as { secure_url?: string }` (dòng 14–17) và `as { public_id?: string }` (dòng 33–36). Cùng 1 hàm trả về 2 shape khác nhau qua type assertion → dễ sai, nên định nghĩa `CloudinaryUploadResult` rõ ràng.

---

### 2.9. Các service sạch (Token, Email, MQTT, IngredientClassification, ContentNotification) (🟢)

- **`token.service.ts`** — 1 trách nhiệm (JWT + token DB), các hàm rõ ràng. ✅
- **`email.service.ts`** — 1 trách nhiệm (gửi mail), tách `renderTemplate`. ✅
- **`mqtt.service.ts`** — Class-based singleton, handler registry + match wildcard tách riêng. ✅
- **`ingredientClassification.service.ts`** — Class-based, `initialize()` lazy + singleton, tiền xử lý ảnh tách hàm riêng. Mẫu tốt để tham khảo khi refactor IoT. ✅
- **`contentNotification.service.ts`** — Adapter thuần, chỉ chuyển lời gọi sang `notificationService`. ✅

---

## 3. Vấn đề xuyên suốt (Cross-cutting)

### 3.1. Phụ thuộc trực tiếp vào `prisma`/`redis` ở mọi service
Hầu hết service import trực tiếp `prisma`/`redis` (DIP vi phạm). Với quy mô hiện tại chấp nhận được, nhưng các service *mới* nên bơm qua tham số/interface để dễ test.

### 3.2. Barrel `services/index.ts` không nhất quán
`src/services/index.ts` chỉ export 5 service (auth, user, token, email, ingredientClassifier), trong khi các controller import trực tiếp từng file (`../services/meal.service`, `../services/iot.service`, ...). Các module khác không vào barrel → thiếu nhất quán, khó theo dõi dependency. Nên chọn 1 trong 2 cách.

### 3.3. Dùng `any` tràn lan
Tập trung ở `recommendation.service.ts` (`getMissingIngredients`, `rebuildShoppingList`, `getSubRecommendations`, `updateRecommendation`). Phá vỡ lợi ích TypeScript và ẩn bug runtime.

### 3.4. Response format không thống nhất
- User controller: 2 kiểu (raw + `successResponse`).
- Các controller khác: dùng `successResponse` đều đặn. Cần thống nhất.

### 3.5. State module-scope mutable
- `iot.service.ts`: `sseClients`, `scanJobQueue`, `activeScanJobs` → không scale multi-instance, khó test.
- `recommendation.queue.service.ts`: `recommendationQueue`, `recommendationWorker` singleton → chấp nhận được nhưng cần kiểm soát khởi tạo.

---

## 4. Thứ tự ưu tiên refactor (đề xuất)

1. **Recommendation** (dễ thấy lợi ích nhất): tách mock data, phá circular dependency giữa `recommendation.service` ↔ `recommendation.queue.service`, thay `any` bằng type có sẵn. **Ưu tiên 1 — rủi ro đang có vòng phụ thuộc.**
2. **IoT**: tách queue / scan / SSE / device / upload. **Ưu tiên 2 — lớn nhất về dòng code, ảnh hưởng runtime (SSE + MQTT) nên refactor cẩn thận.**
3. **User**: tách `pushToken` + `cache` khỏi user service; thống nhất response format; chuyển `sendTestNotification`/`clearCache` ra khỏi controller. **Ưu tiên 3 — nhanh, ít rủi ro.**
4. **Meal**: gộp trùng lặp 2 luồng create; tách phụ thuộc fridge qua interface. **Ưu tiên 4.**
5. **Nutrition / Ingredient**: tinh chỉnh nhẹ. **Ưu tiên 5.**

> Khi refactor, tuân thủ các nguyên tắc trong `.agent/OVERVIEW.md`: giữ nguyên cấu trúc thư mục hiện tại, controllers mỏng, business logic trong services, không giới thiệu framework mới không cần thiết.
