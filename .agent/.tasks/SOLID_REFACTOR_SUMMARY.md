# BÁO CÁO TỔNG KẾT REFACTOR SOLID — SMART FOOD BACKEND

> **Dự án:** Smart Food Backend (`smart-food-be`)  
> **Ngày hoàn thành:** 04/09/2026  
> **Trạng thái:** ✅ **HOÀN THÀNH 100%** (Đã qua kiểm tra `pnpm build`, `git diff --check`, `pnpm lint`)

---

## 1. MỤC TIÊU VÀ PHẠM VI XỬ LÝ

Thực hiện rà soát (Audit) và tiếp tục hoàn thiện quá trình tái cấu trúc mã nguồn theo các nguyên tắc **SOLID** cho 6 module backend:
1. **Recommendation** (Gợi ý thực đơn, BullMQ queue, AI adapter, nutrition/sub calculation)
2. **IoT** (Xử lý quét ảnh nguyên liệu, AI ONNX inference, MQTT heartbeat, SSE streaming, device pairing)
3. **User** (Quản lý người dùng, Expo push token, System cache & notification)
4. **Meal** (Nhật ký bữa ăn, tính toán dinh dưỡng, tự động trừ tủ lạnh)
5. **Nutrition** (Tổng hợp dinh dưỡng ngày/tuần, tính toán chỉ số TDEE/Macro target)
6. **Ingredient** (CRUD nguyên liệu, cache invalidation, thông báo content)

> *Lưu ý:* Giữ nguyên các module đã reviewed: `auth`, `dish`, `notification`, `fridge`. Không thay đổi framework, không thay đổi cấu trúc DB Prisma, không thay đổi đường dẫn API hay contract dữ liệu.

---

## 2. BẢNG TỔNG HỢP KIẾN TRÚC & PHÂN CHIA TRÁCH NHIỆM (SRP)

### 2.1. Module Recommendation (Tách từ God Object ~720 dòng)
| Service / File | Trách nhiệm chính (SRP) |
|---|---|
| [`job.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/job.service.ts) | Quản lý vòng đời Recommendation Job (Tạo, Đọc, Cập nhật swap món), Lưu DB & Cache Redis 7 ngày (`recommendation:job:<id>`). |
| [`aiAdapter.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/aiAdapter.service.ts) | Chọn lựa và điều hướng giữa Mock AI provider và External Recommendation API. |
| [`mockData.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/mockData.ts) | Đưa template dữ liệu mock khổng lồ (`RECOMMENDATION_OUTPUT_TEMPLATE`) ra file cấu hình dữ liệu riêng. |
| [`sub.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/sub.service.ts) | Tìm kiếm các món ăn thay thế (`getSubRecommendations`), tính toán nguyên liệu còn thiếu dựa trên tủ lạnh, dùng strongly-typed interface. |
| [`nutrition.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/nutrition.service.ts) | Tính toán dinh dưỡng thực đơn và tái thiết lập danh sách mua sắm (Shopping List). |
| [`worker.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/worker.service.ts) | Xử lý công việc async của BullMQ worker (Cập nhật PENDING → PROCESSING → SUCCESS/FAILED, gửi Push Notification best-effort). |
| [`queue.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/queue.service.ts) | Đóng gói BullMQ Queue / Worker connection. Khởi tạo worker thông qua **Dependency Injection** (không import ngược facade). |
| [`index.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation/index.ts) | Facade Re-export công khai (21 dòng) cho Module Recommendation. |

### 2.2. Module IoT (Tách từ God Object ~600 dòng)
| Service / File | Trách nhiệm chính (SRP) |
|---|---|
| [`scanQueue.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot/scanQueue.service.ts) | Quản lý hàng đợi scan trong bộ nhớ & điều phối concurrency. |
| [`scanProcessor.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot/scanProcessor.service.ts) | Điều phối quy trình scan: AI ONNX prediction → Upload Cloudinary → tra cứu nguyên liệu/calo → publish kết quả. |
| [`mqttPublisher.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot/mqttPublisher.service.ts) | Publish kết quả scan qua MQTT và quản lý lắng nghe Heartbeat thiết bị qua Redis TTL cache (180s). |
| [`sse.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot/sse.service.ts) | Quản lý registry kết nối Server-Sent Events (SSE) và stream kết quả scan về thiết bị client. |
| [`device.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot/device.service.ts) | Quản lý liên kết thiết bị (`pairDevice`, `unpairDevice`, `getMyDevices`, `getDeviceStatus`). |
| [`index.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot/index.ts) | Facade Re-export công khai (21 dòng) cho Module IoT. |

### 2.3. Module User
| Service / File | Trách nhiệm chính (SRP) |
|---|---|
| [`user.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/user/user.service.ts) | Chỉ tập trung vào CRUD tài khoản và thông tin cá nhân (Profile). |
| [`pushToken.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/user/pushToken.service.ts) | Quản lý lưu trữ Expo push token của người dùng. |
| [`system.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/user/system.service.ts) | Xử lý tác vụ hệ thống: Xóa cache an toàn theo prefix (loại bỏ hoàn toàn `redis.flushall()`) & gửi thông báo kiểm thử. |

### 2.4. Module Meal & Nutrition
| Service / File | Trách nhiệm chính (SRP) |
|---|---|
| [`meal.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/meal/meal.service.ts) | Tái sử dụng luồng chung `createMealLogAndDeductFridge` cho cả món ăn có sẵn và món ăn tự tạo; trừ kho tự động & ghi nhận snapshot. Tách biệt phụ thuộc tủ lạnh qua `FridgeInventoryPort`. |
| [`userMetric.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/user/userMetric.service.ts) | Tra cứu chỉ số cơ thể người dùng và tính toán TDEE / target macro mặc định. |
| [`nutrition.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/nutrition/nutrition.service.ts) | Tổng hợp dữ liệu dinh dưỡng ngày / tuần. |

---

## 3. XỬ LÝ VI PHẠM PHỤ THUỘ VÀ KHỞI TẠO HỆ THỐNG

### 3.1. Triệt tiêu Circular Dependency ở Recommendation
- **Vấn đề trước refactor:** `recommendation.service.ts` ↔ `recommendation.queue.service.ts` phụ thuộc vòng lẫn nhau.
- **Giải pháp:** 
  1. Tách logic sinh AI sang `recommendation.aiAdapter.service.ts`.
  2. `recommendation.queue.service.ts` nhận hàm `generateRecommendation` qua tham số khởi tạo `initRecommendationWorker(generateFn)`.
  3. Tại [`src/index.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/index.ts), inject trực tiếp hàm generation vào worker lúc bootstrap server.

### 3.2. Loại bỏ Side-Effect ở Module Scope (IoT)
- **Vấn đề trước refactor:** `mqttService.subscribe(...)` chạy ngay lập tức khi file được `import`.
- **Giải pháp:** Đưa việc subscribe vào hàm `init()` của `iot.mqttPublisher.service.ts` và gọi tập trung từ [`src/index.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/index.ts) khi ứng dụng bắt đầu lắng nghe port.

### 3.3. Loại bỏ lệnh `redis.flushall()` nguy hiểm
- Thay thế toàn bộ việc xóa toàn bộ Redis cache bằng phương thức invalidation theo danh sách prefix định sẵn (`DISH_LIST_PREFIX`, `INGREDIENT_LIST_PREFIX`, v.v.) trong `system.service.ts`.

---

## 4. DANH SÁCH FILE THAY ĐỔI & TẠO MỚI

### File chỉnh sửa (11 files):
1. [`.gitignore`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/.gitignore)
2. [`src/controllers/recommendation.controller.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/controllers/recommendation.controller.ts)
3. [`src/controllers/user.controller.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/controllers/user.controller.ts)
4. [`src/index.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/index.ts)
5. [`src/models/types/iot.type.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/models/types/iot.type.ts)
6. [`src/services/iot.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot.service.ts)
7. [`src/services/meal.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/meal.service.ts)
8. [`src/services/nutrition.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/nutrition.service.ts)
9. [`src/services/recommendation.queue.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.queue.service.ts)
10. [`src/services/recommendation.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.service.ts)
11. [`src/services/user.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/user.service.ts)

### File tạo mới (14 files):
1. [`src/services/recommendation.mockData.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.mockData.ts)
2. [`src/services/recommendation.aiAdapter.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.aiAdapter.service.ts)
3. [`src/services/recommendation.job.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.job.service.ts)
4. [`src/services/recommendation.sub.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.sub.service.ts)
5. [`src/services/recommendation.nutrition.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.nutrition.service.ts)
6. [`src/services/recommendation.worker.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/recommendation.worker.service.ts)
7. [`src/services/iot.scanQueue.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot.scanQueue.service.ts)
8. [`src/services/iot.scanProcessor.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot.scanProcessor.service.ts)
9. [`src/services/iot.mqttPublisher.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot.mqttPublisher.service.ts)
10. [`src/services/iot.sse.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot.sse.service.ts)
11. [`src/services/iot.device.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/iot.device.service.ts)
12. [`src/services/pushToken.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/pushToken.service.ts)
13. [`src/services/system.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/system.service.ts)
14. [`src/services/userMetric.service.ts`](file:///Users/apple/QUOCDUY/DUT/KY%206/PBL5/smart-food-be/src/services/userMetric.service.ts)

---

## 5. KẾT QUẢ VERIFICATION CHECKPOINTS

| Lệnh kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm build` | ✅ **SUCCESS** | Biên dịch TypeScript hoàn toàn sạch lỗi (0 errors). |
| `git diff --check` | ✅ **SUCCESS** | Không có lỗi khoảng trắng thừa (trailing whitespace) hay format. |
| `pnpm lint` | ✅ **SUCCESS** | Không có lỗi ESLint trên toàn bộ codebase. |

---

## 6. CAM KẾT VỀ CONTRACT VÀ HÀNH VI API

- **Hành vi API:** Không có bất kỳ thay đổi nào làm ảnh hưởng đến Frontend hay Mobile App (Không thay đổi status code, không đổi route, giữ nguyên định dạng JSON trả về qua `successResponse`).
- **An toàn mã nguồn:** Không tạo file test thừa, không sửa Prisma schema, không tự ý thay đổi thư viện ngoài.
