# Review SOLID cho module ingredient

## Phạm vi đã đọc

- `src/controllers/ingredient.controller.ts`
- `src/services/ingredient.service.ts`
- `src/services/ingredientClassification.service.ts`
- `src/routes/v1/ingredient.route.ts`
- `src/validations/ingredient.validation.ts`
- `src/models/interfaces/ingredient.interface.ts`
- Đối chiếu thêm: `src/services/contentNotification.service.ts`, `src/utils/cache.ts`, và pattern đã refactor của module `fridge` (`fridgeItemQuery.ts`, `fridgeTransaction.service.ts`, `fridgeInventory.service.ts`).

## Kết luận nhanh

Module `ingredient` **nhỏ và gọn hơn** module `fridge`, mức vi phạm SOLID nhẹ hơn. Tuy nhiên vẫn có:

- **Một bug thật (ưu tiên cao):** logic sort trong `getIngredients` map enum `IngredientSortBy` (`NAME`, `CREATED_AT`) trực tiếp vào `orderBy` của Prisma. Prisma không có field tên `NAME`/`CREATED_AT` (field thật là `name`, `createdAt`), nên **mọi request có `sortBy=NAME` hoặc `sortBy=CREATED_AT` sẽ ném lỗi runtime**. Đây vừa là lỗi OCP (hard-code mapping) vừa là lỗi correctness.
- Một số **inconsistency về `isDeleted`**: list filter `isDeleted: false`, nhưng `getIngredientById` và `syncIngredients` không filter — trả về cả bản ghi đã soft-delete.
- `getIngredientById` có thể trả `null` nhưng controller vẫn trả HTTP 200, không có 404.
- Service `ingredient.service.ts` gom nhiều trách nhiệm: query DB, build cache key, invalidate cache, gọi notification. Phụ thuộc trực tiếp Prisma singleton (DIP).
- `ingredientClassification.service.ts` là một concern hoàn toàn khác (AI inference) nhưng cùng tiền tố tên module — nội bộ class này thiết kế khá tốt.
- Interface file gom lẫn domain entity, DTO input, response shape và query enum (ISP).

Ưu tiên: **sửa bug sort trước**, sau đó tách query helper + đồng nhất rule `isDeleted`, cuối cùng mới cân nhắc tách repository.

---

## Phân tích theo SOLID

## 1. Single Responsibility Principle (SRP)

### Dấu hiệu vi phạm

`src/services/ingredient.service.ts` đang làm nhiều việc trong cùng một file:

- Truy vấn Prisma: create / update / findMany / findFirst / count / soft-delete.
- Build cache key list (`buildListCacheKey`) và cache key sync.
- Đọc/ghi/invalidate cache (`getCache`, `setCache`, `invalidateIngredientCaches`).
- Build `whereClause` và pagination cho query list.
- Gọi side-effect notification (`contentNotificationService.notify*`).

Nghĩa là service có nhiều lý do để thay đổi: đổi chiến lược cache, đổi rule filter, đổi cách phát notification, đổi data-access — đều phải sửa file này.

### Ví dụ cụ thể

`getIngredients` (dòng 71–109) vừa:

- build cache key,
- đọc cache,
- build `Prisma.IngredientWhereInput`,
- xử lý pagination (`skip`, `take`),
- gọi `findMany` + `count`,
- đóng gói `{ control, results }`,
- ghi cache.

Thêm một filter mới (ví dụ lọc theo khoảng dinh dưỡng) là hàm này lại phình ra.

### Đề xuất sửa

Nhẹ, hợp với codebase hiện tại (giống cách `fridge` đã tách):

- Tạo `src/services/ingredientQuery.ts` với các hàm thuần:
  - `buildIngredientWhere(filter)` → trả `Prisma.IngredientWhereInput`
  - `buildIngredientOrderBy(sortBy)` → dùng map cấu hình (xem OCP)
  - `normalizePagination(options)` → `{ skip, take, page, limit }`
- Giữ cache logic tập trung nhưng tách helper `getIngredientListCacheKey` / `getIngredientDetailCacheKey` cho rõ ràng.
- Side-effect notification giữ nguyên ở service (đã tách sẵn qua `contentNotification.service.ts` — điểm này đang tốt).

---

## 2. Open/Closed Principle (OCP)

### Dấu hiệu vi phạm — kèm BUG thật

Trong `getIngredients` (dòng 82, 90):

```ts
const { sortBy = 'id', limit = 10, page = 1 } = options;
// ...
orderBy: [{ [sortBy]: 'asc' }],
```

Validation chỉ cho phép `sortBy ∈ { NAME, CREATED_AT }` (từ enum `IngredientSortBy`):

```ts
// ingredient.interface.ts
export enum IngredientSortBy {
  NAME = 'NAME',
  CREATED_AT = 'CREATED_AT'
}
```

Nhưng Prisma model `Ingredient` **không có field `NAME` hay `CREATED_AT`** — field thật là `name`, `createdAt`. Do đó:

- Client gọi `?sortBy=NAME` → `orderBy: [{ NAME: 'asc' }]` → **Prisma ném lỗi "Unknown argument NAME"** (runtime error, 500).
- Chỉ hoạt động khi client KHÔNG truyền `sortBy` (rơi về default `'id'`).

Đây là biểu hiện điển hình của OCP yếu: enum API và field DB được nối trực tiếp, không qua tầng ánh xạ, dẫn tới sai khi mở rộng.

### Đề xuất sửa

Dùng map cấu hình tập trung (đúng pattern `fridgeItemSortFieldMap` mà module fridge đã áp dụng):

```ts
// ingredientQuery.ts
const ingredientSortFieldMap: Record<
  IngredientSortBy,
  keyof Prisma.IngredientOrderByWithRelationInput
> = {
  [IngredientSortBy.NAME]: 'name',
  [IngredientSortBy.CREATED_AT]: 'createdAt'
};

export const buildIngredientOrderBy = (
  sortBy?: IngredientSortBy
): Prisma.IngredientOrderByWithRelationInput => {
  const field = sortBy ? ingredientSortFieldMap[sortBy] : 'id';
  return { [field]: 'asc' };
};
```

Lợi ích: thêm sort field mới chỉ cần sửa map + enum + validation ở một chỗ, không đụng logic service, và không còn nguy cơ truyền thẳng chuỗi enum vào Prisma.

---

## 3. Liskov Substitution Principle (LSP)

### Đánh giá

- Module CRUD (`ingredient.service.ts`) không dùng inheritance/đa hình nên chưa có vi phạm LSP.
- `IngredientClassificationService` là class đơn, không có subclass, cũng không vi phạm.

### Rủi ro liên quan (nếu sau này tách repository/interface)

Cần quy ước nhất quán khi tạo abstraction:

- `getIngredientById` hiện trả `IIngredient | null`. Nếu tách interface repository, mọi implementation phải giữ đúng hợp đồng "không tìm thấy → `null`", không được implementation này throw còn implementation kia trả `null`.
- Rule "bản ghi hợp lệ" (loại `isDeleted = true`) phải được áp dụng đồng nhất ở mọi hàm đọc (hiện đang không đồng nhất — xem mục "Vấn đề thiết kế").

---

## 4. Interface Segregation Principle (ISP)

### Dấu hiệu yếu

`src/models/interfaces/ingredient.interface.ts` gom nhiều vai trò trong một file:

- Domain entity: `IIngredient`.
- API input DTO: `CreateIngredientInput`, `UpdateIngredientInput`.
- Response shape: `IngredientListResult`.
- Query enum: `IngredientSortBy`.

Chưa gây lỗi trực tiếp, nhưng mỗi tầng phải import cùng một file lớn hơn nhu cầu (validation chỉ cần enum, controller cần DTO, service cần cả DTO lẫn result type).

Ngoài ra có **sai lệch giữa DTO và validation**:

- `CreateIngredientInput` khai báo `unit: Unit` (bắt buộc), nhưng `validation.createIngredient` để `unit` **optional**. Type nói bắt buộc, runtime lại cho phép thiếu → dễ hiểu nhầm hợp đồng API.

### Đề xuất sửa

- Tách file type theo vai trò (giống hướng đề xuất cho fridge):
  - `ingredient.model.ts` — entity/domain.
  - `ingredient.dto.ts` — input + response.
  - `ingredient.query.ts` — filter, options, sort enum.
  - `ingredient.interface.ts` — barrel export (`export * from ...`) để không phải sửa import bên ngoài.
- Đồng bộ lại `unit`: hoặc để `unit?: Unit` trong DTO cho khớp validation, hoặc đặt `unit` `required()` trong validation cho khớp type. Chọn một nguồn sự thật.

---

## 5. Dependency Inversion Principle (DIP)

### Dấu hiệu vi phạm

`src/services/ingredient.service.ts` phụ thuộc trực tiếp:

```ts
import prisma from '../client';
import { Prisma } from '@prisma/client';
```

Service gắn chặt Prisma singleton và Prisma type (`Prisma.IngredientWhereInput`). Hệ quả:

- Khó unit test service mà không mock Prisma singleton.
- Khó đổi chiến lược data-access.
- Logic query trộn với logic nghiệp vụ.

### Đề xuất sửa

Giải pháp nhẹ (khuyên làm trước):

- Tách các hàm thuần (`buildIngredientWhere`, `buildIngredientOrderBy`, `normalizePagination`) ra `ingredientQuery.ts` để test riêng, không cần Prisma.

Giải pháp mạnh hơn (khi module lớn thêm):

- Tạo `ingredient.repository.ts` chỉ phụ trách Prisma:
  - `create(data)`, `update(id, data)`, `softDelete(id)`
  - `findMany(where, orderBy, pagination)`, `count(where)`
  - `findById(id)`, `findManyForSync(where)`
- Service chỉ orchestration + cache + notification, phụ thuộc vào API repository thay vì Prisma trực tiếp.

Codebase chưa có DI framework, nên chỉ cần export object module như `fridge.repository`-style là đủ, không cần đưa DI container vào.

---

## Các vấn đề thiết kế / correctness liên quan module ingredient

## 1. Không đồng nhất rule `isDeleted` (ưu tiên cao)

- `getIngredients`: có `isDeleted: false` (đúng).
- `getIngredientById` (dòng 118): `findFirst({ where: { id } })` — **thiếu `isDeleted: false`**, nên vẫn trả về nguyên liệu đã bị xóa mềm.
- `syncIngredients` (dòng 145–148): where chỉ có `updatedAt >= lastSyncAt`, không filter `isDeleted`.

Rủi ro: đã "xóa" nhưng vẫn xem được chi tiết; client đồng bộ vẫn nhận bản ghi đã xóa (trừ khi sync cố tình gửi cả bản đã xóa để client tự gỡ — nếu vậy nên có cờ trạng thái rõ ràng, không im lặng).

Đề xuất:

- `getIngredientById`: thêm `where: { id: ingredientId, isDeleted: false }`.
- `syncIngredients`: quyết định rõ hợp đồng — nếu muốn client biết bản ghi bị xóa thì trả kèm `isDeleted`; nếu không thì thêm `isDeleted: false`.

## 2. `getIngredientById` trả `null` nhưng controller không 404

`getIngredientById` có thể trả `null`, nhưng controller (dòng 41–51) luôn `res.send(... OK ...)`. Client nhận `200` với `data: null` thay vì `404 Not Found`.

Đề xuất: service hoặc controller nên throw `ApiError(NOT_FOUND)` khi không tìm thấy (theo pattern các module khác trong dự án).

## 3. Cache list vẫn cache cả khi `total = 0`

`getIngredients` luôn `setCache` kể cả khi rỗng. Không phải lỗi nghiêm trọng, nhưng khác với `syncIngredients` (chỉ cache khi `length > 0`). Nên thống nhất chính sách cache rỗng để tránh nhầm khi debug.

## 4. `ingredientClassification.service.ts` khác concern nhưng chung tên module

File này là AI inference (ONNX + sharp), thiết kế nội bộ **khá tốt**: đóng gói private method, lazy `initialize()` idempotent, tách `preprocessImage`/`predict`/`normalizeLabel`. Điểm lưu ý:

- Không được controller/route `ingredient` nào dùng — nếu đang mồ côi thì nên nối vào một route (vd `POST /ingredients/classify`) hoặc ghi chú rõ nơi tiêu thụ.
- Vì khác hẳn concern CRUD, nên đặt trong thư mục con `services/ai/` hoặc `services/ingredient/classification.service.ts` để tên module không gợi ý nhầm rằng nó thuộc luồng CRUD.

## 5. (Nếu có) encoding message tiếng Việt

Kiểm tra lại các literal tiếng Việt trong controller/service khi lưu file. Nếu môi trường soạn thảo không dùng UTF-8, một số message có thể bị mojibake như đã thấy ở module fridge. Hiện tại các message trong `ingredient.controller.ts` đọc ra vẫn đúng UTF-8.

---

## Lộ trình refactor đề xuất

## Bước 1 — Sửa bug + đồng nhất rule (rủi ro thấp, làm ngay)

1. Sửa bug sort: thêm `buildIngredientOrderBy` dùng `ingredientSortFieldMap` (mục OCP).
2. Thêm `isDeleted: false` cho `getIngredientById`; quyết định rule cho `syncIngredients`.
3. Trả `404` khi không tìm thấy ingredient.
4. Đồng bộ `unit` giữa DTO và validation.

Lợi ích: hết lỗi runtime sort, hết rò rỉ bản ghi đã xóa, hợp đồng API rõ ràng — không đổi route.

## Bước 2 — Tách query helper (SRP/DIP nhẹ)

- Tạo `src/services/ingredientQuery.ts`: `buildIngredientWhere`, `buildIngredientOrderBy`, `normalizePagination`.
- Service gọi helper thay vì tự dựng `whereClause`/pagination.

## Bước 3 — Tách interface theo vai trò (ISP)

- `ingredient.model.ts` / `ingredient.dto.ts` / `ingredient.query.ts` + barrel export.

## Bước 4 — Tách repository (DIP, làm khi module lớn thêm)

- `ingredient.repository.ts` gom toàn bộ Prisma; service chỉ orchestration + cache + notification.

## Bước 5 — Sắp xếp lại classification service

- Chuyển vào `services/ai/` hoặc `services/ingredient/`, nối route sử dụng rõ ràng.

---

## Kiểm thử nên bổ sung sau refactor

- `buildIngredientOrderBy`:
  - `NAME` → `{ name: 'asc' }`, `CREATED_AT` → `{ createdAt: 'asc' }`, không truyền → `{ id: 'asc' }`.
- `buildIngredientWhere`:
  - luôn có `isDeleted: false`.
  - lọc `name` dùng `contains` + `insensitive`.
  - lọc `categoryId` khi có.
- `getIngredientById`:
  - trả `null`/404 khi id không tồn tại hoặc đã xóa mềm.
- `syncIngredients`:
  - lọc theo `updatedAt >= lastSyncAt`.
  - hành vi với bản ghi `isDeleted` theo hợp đồng đã chốt.
- Cache:
  - create/update/delete đều gọi invalidate list + detail đúng key.

---

## Đánh giá ưu tiên

| Mục | Vấn đề | Nguyên tắc liên quan | Ưu tiên |
| --- | --- | --- | --- |
| 1 | Sort map enum → field Prisma gây lỗi runtime | OCP + correctness | **Cao** |
| 2 | `getIngredientById`/`syncIngredients` không lọc `isDeleted` | Consistency/correctness | **Cao** |
| 3 | Không trả 404 khi không tìm thấy | API contract | Trung bình - Cao |
| 4 | Service gom nhiều trách nhiệm (query/cache/notify) | SRP | Trung bình |
| 5 | Phụ thuộc trực tiếp Prisma singleton | DIP | Trung bình |
| 6 | Interface gom lẫn vai trò + lệch `unit` DTO/validation | ISP | Thấp - Trung bình |
| 7 | `classification.service` khác concern, có thể mồ côi | SRP/tổ chức | Thấp - Trung bình |

---

*Ghi chú: `ingredientClassification.service.ts` là điểm sáng về đóng gói (encapsulation) trong module — nên giữ nguyên phong cách class private-method này làm mẫu khi tách các service khác.*
