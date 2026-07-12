# Review SOLID cho module ingredient - Codex

## Pham vi da doc

- `src/services/ingredient.service.ts`
- `src/controllers/ingredient.controller.ts`
- `src/routes/v1/ingredient.route.ts`
- `src/validations/ingredient.validation.ts`
- `src/models/interfaces/ingredient.interface.ts`
- `src/services/ingredientClassification.service.ts`
- `prisma/schema.prisma`
- Cac diem tieu thu lien quan den classification service:
  - `src/index.ts`
  - `src/app.ts`
  - `src/services/iot.service.ts`

## Ket luan nhanh

Module `ingredient` nho va de nam hon module `fridge`, nhung chua thuc su sach theo SOLID. Muc do vi pham khong qua nang, nhung co nhieu van de correctness nen uu tien sua truoc khi refactor kien truc.

Nhung diem quan trong nhat:

- Co bug runtime o sort: validation cho phep `sortBy=NAME` va `sortBy=CREATED_AT`, nhung `ingredient.service.ts` dua thang gia tri nay vao Prisma `orderBy`. Prisma model khong co field `NAME` / `CREATED_AT`, chi co `name` / `createdAt`.
- `ingredient.service.ts` dang gom nhieu trach nhiem: data access, build query, pagination, cache, cache invalidation va notification.
- Soft delete khong nhat quan: list loc `isDeleted: false`, nhung detail va sync khong loc.
- `getIngredientById` co the tra `null`, nhung controller van tra response thanh cong HTTP 200.
- DTO va validation lech nhau o field `unit`: TypeScript type yeu cau `unit`, Joi validation lai cho optional.
- `ingredient.interface.ts` gom nhieu vai tro trong mot file. Day la ISP yeu, nhung voi quy mo hien tai chua phai uu tien cao.
- `ingredientClassification.service.ts` la concern khac voi CRUD ingredient, nhung khong phai code chet. No duoc initialize trong app, dung cho health check va duoc `iot.service.ts` goi de predict.

Uu tien de xuat:

1. Sua sort bug.
2. Dong nhat rule `isDeleted`.
3. Tra 404 khi detail khong ton tai.
4. Dong bo DTO/validation cho `unit`.
5. Sua cache key sync theo full timestamp.
6. Sau do moi tach query helper va can nhac repository.

## 1. Single Responsibility Principle

### Danh gia

`src/services/ingredient.service.ts` dang vi pham SRP o muc trung binh. Service nay khong chi dieu phoi use case, ma con xu ly truc tiep nhieu concern khac nhau.

### Bang chung trong code

Trong `src/services/ingredient.service.ts`:

- Data access bang Prisma:
  - create: dong 31-42.
  - update: dong 53-65.
  - list: dong 88-94.
  - detail: dong 118-123.
  - soft delete: dong 130-132.
  - sync: dong 149-152.
- Query construction:
  - list where/order/pagination: dong 81-92.
  - sync where: dong 145-148.
- Cache:
  - build cache key: dong 75, 139-141.
  - read cache: dong 78-79, 115-116, 142-144.
  - write cache: dong 105-106, 122-123, 154-155.
  - invalidate cache: dong 22-27.
- Notification side effects:
  - create notification: dong 44.
  - update notification: dong 67.
  - delete notification: dong 135.

Mot file co nhieu ly do de thay doi:

- Doi rule filter.
- Doi sort/pagination.
- Doi cache key/TTL/invalidation.
- Doi notification event.
- Doi Prisma query.
- Doi soft-delete policy.

Day la dau hieu SRP yeu.

### Anh huong

Ham `getIngredients` la vi du ro nhat:

- Doc cache.
- Build where.
- Build order.
- Xu ly pagination.
- Query list va count.
- Dong goi response.
- Ghi cache.

Neu them filter moi, them sort moi, thay doi cache strategy, hoac doi response contract, cung ham nay phai sua.

### De xuat sua

Buoc nhe, nen lam:

- Tao `src/services/ingredientQuery.service.ts`.
- Chuyen cac ham pure sang file nay:

```ts
buildIngredientWhere(filter)
buildIngredientOrderBy(sortBy)
normalizePagination(options)
```

`ingredient.service.ts` sau refactor nen chi con dieu phoi:

- doc cache,
- goi query helper,
- goi Prisma,
- set cache,
- invalidate cache,
- goi notification.

Buoc tiep theo neu cache lon hon:

- Tao `src/services/ingredientCache.service.ts` de gom:
  - `buildIngredientListCacheKey`
  - `buildIngredientSyncCacheKey`
  - `invalidateIngredientCaches`

Khong nen tach qua nhieu ngay lap tuc vi module van con nho.

## 2. Open/Closed Principle

### Danh gia

Module hien vi pham OCP ro nhat o logic sort. API enum va Prisma field dang bi noi truc tiep voi nhau, khong co mapping layer.

### Bug sort hien tai

Trong `src/models/interfaces/ingredient.interface.ts`:

```ts
export enum IngredientSortBy {
  NAME = 'NAME',
  CREATED_AT = 'CREATED_AT'
}
```

Trong `src/validations/ingredient.validation.ts`, query `sortBy` chi cho phep cac gia tri tu enum nay.

Trong `src/services/ingredient.service.ts`:

```ts
const { sortBy = 'id', limit = 10, page = 1 } = options;
// ...
orderBy: [{ [sortBy]: 'asc' }]
```

Nhung trong Prisma schema, field thuc te cua model `Ingredient` la:

- `id`
- `name`
- `createdAt`
- `updatedAt`
- `categoryId`
- ...

Khong co field `NAME` hay `CREATED_AT`.

### He qua

Request khong truyen `sortBy` thi default `id` hoat dong.

Request hop le theo validation:

```http
GET /ingredients?sortBy=NAME
GET /ingredients?sortBy=CREATED_AT
```

co nguy co gay Prisma runtime error vi service tao:

```ts
orderBy: [{ NAME: 'asc' }]
orderBy: [{ CREATED_AT: 'asc' }]
```

Day la bug correctness, khong chi la style.

### De xuat sua

Them query helper dung map cau hinh:

```ts
const ingredientSortFieldMap: Record<
  IngredientSortBy,
  keyof Prisma.IngredientOrderByWithRelationInput
> = {
  [IngredientSortBy.NAME]: 'name',
  [IngredientSortBy.CREATED_AT]: 'createdAt'
};

const buildIngredientOrderBy = (
  sortBy?: IngredientSortBy
): Prisma.IngredientOrderByWithRelationInput => {
  const field = sortBy ? ingredientSortFieldMap[sortBy] : 'id';
  return { [field]: 'asc' };
};
```

Dong thoi doi type options:

```ts
options: { sortBy?: IngredientSortBy; limit?: number; page?: number }
```

Thay vi:

```ts
options: { sortBy?: string; limit?: number; page?: number }
```

Loi ich:

- Them sort moi chi can them enum + validation + map.
- Khong con dua string API vao Prisma truc tiep.
- Giam nguy co runtime 500.

## 3. Liskov Substitution Principle

### Danh gia

Hien tai module CRUD ingredient khong co inheritance, subclass, hay interface da hinh, nen khong co vi pham LSP truc tiep.

`IngredientClassificationService` cung la class don, khong co subclass, nen khong co LSP issue.

### Rui ro neu sau nay tach abstraction

Neu tao repository/interface, can chot contract ro rang:

- `findById(id)` tra `null` hay throw `ApiError`.
- `findById(id)` co filter `isDeleted: false` hay khong.
- `syncIngredients(lastSyncAt)` co tra deleted records hay khong.
- `deleteIngredient(id)` la hard delete hay soft delete.

Neu implementation A tra `null`, implementation B throw error, hoac implementation A loc deleted con B khong loc, caller se khong the thay the chung an toan. Khi do moi thanh LSP issue.

## 4. Interface Segregation Principle

### Danh gia

`src/models/interfaces/ingredient.interface.ts` dang gom nhieu vai tro:

- Entity/domain shape: `IIngredient`.
- Query enum: `IngredientSortBy`.
- Create DTO: `CreateIngredientInput`.
- Update DTO: `UpdateIngredientInput`.
- Response shape: `IngredientListResult`.

Voi quy mo hien tai, day la ISP yeu nhung chua phai van de lon. Neu module lon them, cac layer se phai import mot file chua nhieu thu hon nhu cau:

- Validation chu yeu can `IngredientSortBy`.
- Controller can DTO.
- Service can DTO + result type.

### Van de contract: DTO lech validation

Trong `ingredient.interface.ts`:

```ts
export type CreateIngredientInput = {
  // ...
  unit: Unit;
};
```

Trong `ingredient.validation.ts`:

```ts
unit: Joi.string()
  .valid(...Object.values(Unit))
  .optional()
```

Trong Prisma schema:

```prisma
unit Unit @default(GAM)
```

Runtime cho phep thieu `unit` vi Joi optional va Prisma co default, nhung TypeScript DTO lai noi `unit` bat buoc. Day la contract mismatch.

### De xuat sua

Nen sua truoc mismatch `unit`:

- Neu muon dung default `GAM` cua Prisma: doi DTO thanh `unit?: Unit`.
- Neu API bat buoc client gui unit: doi Joi thanh `.required()`.

Khuyen nghi: doi DTO thanh optional vi schema da co default.

Chi tach interface file khi module lon hon:

- `ingredient.model.ts`: entity/domain type.
- `ingredient.dto.ts`: input/output DTO.
- `ingredient.query.ts`: filter/options/sort enum.
- `ingredient.interface.ts`: barrel export de giu import cu.

## 5. Dependency Inversion Principle

### Danh gia

`ingredient.service.ts` phu thuoc truc tiep vao concrete dependencies:

- Prisma singleton:

```ts
import prisma from '../client';
```

- Prisma type:

```ts
import { Prisma } from '@prisma/client';
```

- Cache implementation:

```ts
import cache, { buildListCacheKey } from '../utils/cache';
```

- Notification service:

```ts
import contentNotificationService from './contentNotification.service';
```

Khong phai luc nao DIP cung bat buoc phai co DI container, nhung hien tai service kho unit test rieng vi query/cache/notification deu la concrete module import truc tiep.

### De xuat sua

Buoc nhe:

- Tach query builder pure ra `ingredientQuery.service.ts`.
- Test `buildIngredientWhere`, `buildIngredientOrderBy`, `normalizePagination` ma khong can Prisma/cache.

Buoc trung binh:

- Tach `ingredient.repository.ts`:

```ts
create(data)
update(id, data)
findMany(where, orderBy, pagination)
count(where)
findById(id)
softDelete(id)
findForSync(where)
```

`ingredient.service.ts` se tap trung vao orchestration:

- cache,
- invalidate,
- notification,
- call repository.

Khong can dua DI framework vao codebase luc nay. Export object module la du.

## Van de correctness/design ngoai SOLID

## 1. Soft delete khong nhat quan

Trong `getIngredients`, service loc:

```ts
isDeleted: false
```

Nhung `getIngredientById` chi query:

```ts
where: { id: ingredientId }
```

Va `syncIngredients` bat dau voi:

```ts
const whereClause: Prisma.IngredientWhereInput = {};
```

Rui ro:

- Ingredient da xoa mem van xem detail duoc.
- Sync co the tra ingredient da xoa.

De xuat:

- `getIngredientById`: them `isDeleted: false`.
- `syncIngredients`: chot contract.
  - Neu sync chi de lay active ingredient: them `isDeleted: false`.
  - Neu sync can tombstone de client xoa local cache: tra ro `isDeleted` va document behavior.

Mac dinh nen loc `isDeleted: false` vi cac endpoint khac dang coi deleted record la hidden.

## 2. Detail endpoint tra 200 voi data null

`ingredient.service.ts`:

```ts
const getIngredientById = async (ingredientId: number): Promise<IIngredient | null>
```

`ingredient.controller.ts`:

```ts
const ingredient = await ingredientService.getIngredientById(Number(ingredientId));
res.send(successResponse({ code: httpStatus.OK, data: ingredient }))
```

Neu khong tim thay, API tra thanh cong voi `data: null`.

De xuat:

- Service throw `ApiError(httpStatus.NOT_FOUND, 'Nguyen lieu khong ton tai')`.
- Controller giu nguyen flow thanh cong khi service tra ingredient.

Lam o service tot hon vi moi caller deu co cung behavior.

## 3. Sync cache key co the sai theo timestamp

Trong `syncIngredients`:

```ts
lastSyncAt ? lastSyncAt.toISOString().slice(0, 10) : 'unknown'
```

Cache key chi dung ngay, nhung query dung full timestamp:

```ts
whereClause.updatedAt = { gte: lastSyncAt };
```

Hai request:

- `2026-07-13T01:00:00Z`
- `2026-07-13T20:00:00Z`

se co cung cache key nhung query logic khac nhau. Day la bug cache tiem an.

De xuat:

- Dung full ISO string:

```ts
lastSyncAt ? lastSyncAt.toISOString() : 'initial'
```

Hoac neu muon cache theo ngay, query cung phai lam tron theo ngay va document ro.

## 4. Delete response code/body khong ro

Trong controller delete:

```ts
res.send(
  successResponse({
    code: httpStatus.NO_CONTENT,
    message: '...'
  })
);
```

Nhung khong goi `res.status(httpStatus.NO_CONTENT)`. Nghia la HTTP status co the van la 200, body lai noi code 204.

HTTP 204 khong nen co response body.

De xuat chon mot trong hai:

- Dung 200 voi body:

```ts
res.status(httpStatus.OK).send(successResponse({ code: httpStatus.OK, message: '...' }));
```

- Hoac dung 204 khong body:

```ts
res.status(httpStatus.NO_CONTENT).send();
```

Voi pattern hien tai cua project hay tra `successResponse`, dung 200 co body de nhat quan hon.

## 5. Message tieng Viet bi mojibake

Trong output hien tai cua `ingredient.controller.ts`, cac literal tieng Viet bi loi encoding:

- `Táº¡o má»›i...`
- `Láº¥y danh sÃ¡ch...`
- `Äá»“ng bá»™...`

Day khong phai SOLID, nhung anh huong API response va maintainability.

De xuat:

- Luu file bang UTF-8.
- Sua lai literal tieng Viet.
- Neu nhieu module bi loi, can thong nhat editor/formatter encoding.

## 6. Ingredient classification service

`src/services/ingredientClassification.service.ts` la AI inference service, khac concern voi CRUD ingredient.

No khong phai code chet:

- `src/index.ts` initialize service khi app start.
- `src/app.ts` dung `isReady()` cho status/health.
- `src/services/iot.service.ts` goi `predictFromBuffer`.

Thiet ke noi bo kha tot:

- Class encapsulation ro.
- `initialize()` idempotent bang `initPromise`.
- Co fallback cho ONNX external data file.
- Tach preprocess va predict thanh private methods.

De xuat nhe:

- Doi ten `ingredientClassification.service.ts` thanh `ingredientClassifier.service.ts` neu muon ngan gon hon.
- Hoac chuyen vao `src/services/ai/ingredientClassification.service.ts` neu folder service tiep tuc lon.

Khong nen uu tien refactor file nay truoc CRUD ingredient.

## Lo trinh refactor de xuat

## Buoc 1 - Sua bug va hop dong API

1. Tao `src/services/ingredientQuery.service.ts`.
2. Them `buildIngredientOrderBy` dung map `IngredientSortBy -> Prisma field`.
3. Doi `getIngredients` options type tu `sortBy?: string` sang `sortBy?: IngredientSortBy`.
4. Them `buildIngredientWhere` luon gom `isDeleted: false`.
5. Them `isDeleted: false` cho `getIngredientById`.
6. Chot `syncIngredients` mac dinh khong tra deleted records, them `isDeleted: false`.
7. Throw 404 khi detail khong tim thay.
8. Sua `unit` trong DTO thanh optional, hoac doi validation thanh required. Khuyen nghi: DTO optional.
9. Sua sync cache key dung full ISO timestamp.
10. Sua delete response thanh HTTP 200 co body, hoac HTTP 204 khong body.
11. Sua message tieng Viet bi mojibake.

## Buoc 2 - Tach trach nhiem vua phai

1. Giu notification trong `ingredient.service.ts`.
2. Neu cache logic tang len, tach `ingredientCache.service.ts`.
3. Chua can tach repository neu chi sua cac bug tren.

## Buoc 3 - Refactor lon khi module mo rong

1. Tao `ingredient.repository.ts` cho Prisma access.
2. Tach type file theo vai tro neu `ingredient.interface.ts` tiep tuc phinh.
3. Sap xep lai AI classification service neu folder services qua lon.

## Test nen bo sung

## Query helper

- `buildIngredientOrderBy(undefined)` tra `{ id: 'asc' }`.
- `buildIngredientOrderBy(IngredientSortBy.NAME)` tra `{ name: 'asc' }`.
- `buildIngredientOrderBy(IngredientSortBy.CREATED_AT)` tra `{ createdAt: 'asc' }`.
- `buildIngredientWhere({})` luon co `isDeleted: false`.
- `buildIngredientWhere({ name })` them contains insensitive.
- `buildIngredientWhere({ categoryId })` them category filter.

## Service behavior

- `getIngredients` khong nem loi voi `sortBy=NAME`.
- `getIngredientById` tra 404 khi id khong ton tai.
- `getIngredientById` tra 404 khi record da `isDeleted = true`.
- `syncIngredients` phan biet cache key cho hai timestamp khac nhau trong cung ngay.
- `deleteIngredient` set `isDeleted: true`, invalidate list cache va detail cache, notify delete.

## Controller behavior

- Detail not found tra HTTP 404.
- Delete endpoint dung HTTP status/body theo contract da chon.
- Response message tieng Viet khong bi mojibake.

## Danh gia uu tien

| Muc | Van de | Nguyen tac lien quan | Uu tien |
| --- | --- | --- | --- |
| 1 | Sort enum dua thang vao Prisma field | OCP + correctness | Cao |
| 2 | Detail/sync khong nhat quan `isDeleted` | Correctness/SRP | Cao |
| 3 | Detail tra 200 voi `data: null` | API contract | Cao |
| 4 | Sync cache key chi theo ngay | Correctness/cache | Trung binh - Cao |
| 5 | DTO `unit` lech validation | ISP/API contract | Trung binh |
| 6 | Service gom query/cache/notify/data-access | SRP | Trung binh |
| 7 | Service phu thuoc Prisma singleton/cache | DIP | Trung binh |
| 8 | Delete response code/body khong ro | API contract | Trung binh |
| 9 | Message tieng Viet bi mojibake | Maintainability | Trung binh |
| 10 | Interface file gom nhieu vai tro | ISP | Thap - Trung binh |
| 11 | Classification service khac concern voi CRUD | Organization/SRP | Thap |

## Khuyen nghi cuoi

Nen sua theo thu tu bug truoc, kien truc sau:

1. Sort mapping.
2. Soft delete consistency.
3. 404 detail.
4. DTO/validation mismatch.
5. Sync cache key.
6. Query helper extraction.

Khong nen tach repository, tach interface, hay di chuyen classification service ngay lap tuc neu muc tieu hien tai la giam rui ro va lam code de maintain hon. Nhung thay doi lon do nen de sau khi cac bug behavior da duoc xu ly va co test bao ve.

