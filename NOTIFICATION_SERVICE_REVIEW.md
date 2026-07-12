# Notification Service Review

## Pham vi da doc

Da kiem tra cac file lien quan trong `src/services` va cac diem goi notification:

- `src/services/notification.service.ts`
- `src/services/dishNotification.service.ts`
- `src/services/dish.service.ts`
- `src/services/ingredient.service.ts`
- `src/services/recommendation.queue.service.ts`
- `src/controllers/dish.controller.ts`
- `src/controllers/ingredient.controller.ts`
- `src/controllers/user.controller.ts`
- `src/routes/v1/user.route.ts`

Dong thoi scan so luong service hien tai trong `src/services`: hien co 20 file service. Cac service lon nhat la:

- `recommendation.service.ts`: 722 dong
- `meal.service.ts`: 674 dong
- `iot.service.ts`: 593 dong
- `fridge.service.ts`: 323 dong
- `recommendation.queue.service.ts`: 323 dong
- `notification.service.ts`: 296 dong
- `user.service.ts`: 287 dong

Nhan xet: so luong service khong phai van de chinh. Van de chinh la ranh gioi trach nhiem chua dong deu: co noi controller tu tao payload notification, co noi service nghiep vu goi notification, co noi worker goi notification truc tiep.

## Hien trang notification

### `notification.service.ts`

Day la service ha tang push notification:

- Lay push token tu DB.
- Loc token hop le bang Expo SDK.
- Gui push notification theo chunk.
- Ghi `PushNotificationLog`.
- Xu ly ticket error va xoa token invalid.
- Cron check receipt.

Ket luan: file nay dang lam dung vai tro infrastructure/transport. Khong nen dua logic nghiep vu dish/ingredient/recommendation vao day neu muon giu code de test va bao tri.

### `dishNotification.service.ts`

Day la service nghiep vu moi them:

- Tao payload khi create dish.
- Tao silent payload khi update/delete dish.
- Goi `notification.service.ts`.
- Bat loi bang `.catch(logger.error)` de notification failure khong lam fail HTTP request.

Ket luan: file nay tach dung muc tieu "dish event -> notification payload". Tuy nhien neu chi co 42 dong va chi dung trong `dish.service.ts`, ten file rieng co the lam cam giac service bi nhieu.

### `ingredient.controller.ts`

Controller van truc tiep import:

- `notification.service`
- `logger`

Va tu tao payload notification cho create/update/delete ingredient. Pattern nay khong dong nhat voi dish. Neu mutation DB fail thi notification khong chay vi service call dat truoc notification, nhung controller van dang om orchestration phu.

### `recommendation.queue.service.ts`

Worker goi `notificationService.sendNotificationToUser` truc tiep sau khi recommendation job thanh cong. Day la notification gan voi worker/job flow, co try/catch rieng va khong lam fail job.

Pattern nay chap nhan duoc tam thoi, nhung neu notification recommendation tiep tuc tang payload/type thi nen tach ra service nghiep vu rieng.

### `user.controller.ts`

Endpoint `/test-notification` goi `notification.service.ts` truc tiep.

Ket luan: day la endpoint test/admin/debug nen goi transport service truc tiep la chap nhan duoc.

## Co nen gop cac notification service lai khong?

Khong nen gop tat ca vao `notification.service.ts`.

Ly do:

- `notification.service.ts` dang la ha tang gui push, ghi log, check receipt. Neu dua payload dish/ingredient/recommendation vao se tron infrastructure voi business rules.
- Cac business event co lifecycle khac nhau: dish/ingredient la mutation HTTP, recommendation la background worker.
- Gop het vao mot file lon se lam `notification.service.ts` phinh to va kho test hon.

Nen gop theo huong nho hon:

1. Giu `notification.service.ts` lam transport/core push service.
2. Tao mot service nghiep vu chung cho notification event cua app, vi du:
   - `appNotification.service.ts`, hoac
   - `domainNotification.service.ts`, hoac
   - `contentNotification.service.ts`.
3. Chuyen `dishNotification.service.ts` vao service nay neu muon giam so file.
4. Chuyen notification payload cua ingredient tu controller vao service nay.
5. De `recommendation.queue.service.ts` co the tam thoi goi `notification.service.ts`, hoac them method `notifyRecommendationReady` vao service nghiep vu neu muon dong nhat.

De xuat thuc te cho repo hien tai:

- Nen gop `dishNotification.service.ts` va payload ingredient vao mot file `contentNotification.service.ts`.
- Khong nen gop vao `notification.service.ts`.
- Khong can tao repository hay event bus trong pass nay.

## Kien truc de xuat

```text
controllers
  -> dish.service.ts / ingredient.service.ts
    -> contentNotification.service.ts
      -> notification.service.ts
        -> Expo + PushNotificationLog + receipt cron

recommendation.queue.service.ts
  -> notification.service.ts
  hoac
  -> appNotification.service.ts
    -> notification.service.ts
```

### Option A: Giu nhu hien tai

Uu diem:

- It thay doi.
- Dish da sach hon controller.

Nhuoc diem:

- Ingredient controller van bi lech pattern.
- Co cam giac notification service bi tach le rieng cho dish.

Danh gia: chap nhan duoc ngan han, nhung chua nhat quan.

### Option B: Gop `dishNotification.service.ts` thanh `contentNotification.service.ts`

Noi dung service:

- `notifyDishCreated(dish)`
- `notifyDishUpdated(dishId)`
- `notifyDishDeleted(dishId)`
- `notifyIngredientCreated(ingredient)`
- `notifyIngredientUpdated(ingredientId)`
- `notifyIngredientDeleted(ingredientId)`

Uu diem:

- Giam so service notification theo tung entity.
- Controller dish/ingredient deu sach.
- Van khong lam ban `notification.service.ts`.

Nhuoc diem:

- `contentNotification.service.ts` co the lon dan neu them nhieu entity.

Danh gia: nen lam.

### Option C: Tao event-style service

Vi du:

- `notifyResourceCreated({ type: 'DISH', id, name })`
- `notifyResourceUpdated({ type: 'INGREDIENT', id })`
- `notifyResourceDeleted({ type: 'DISH', id })`

Uu diem:

- Giam trung lap create/update/delete payload.

Nhuoc diem:

- Can mapping screen/action/name/type.
- De abstract hoi som voi codebase hien tai.

Danh gia: chua can trong pass nay.

## De xuat refactor tiep theo

Thu tu nen lam:

1. Rename/gop `dishNotification.service.ts` thanh `contentNotification.service.ts`.
2. Them ingredient notification methods vao service moi.
3. Chuyen `ingredient.controller.ts` khong import `notification.service` va `logger` nua.
4. Goi notification tu `ingredient.service.ts` sau khi DB mutation va cache invalidation thanh cong.
5. Giu notification failure non-blocking bang `.catch(logNotificationError)`.
6. Giu `notification.service.ts` chi lo gui push, log ticket, receipt cron.

Khong nen lam ngay:

- Khong gop receipt cron vao service nghiep vu.
- Khong dua payload dish/ingredient vao `notification.service.ts`.
- Khong tao event bus/queue rieng cho notification neu chua co nhu cau retry/transactional outbox.

## Checklist test sau refactor

### Static checks

- `dish.controller.ts` khong import `notification.service` hoac `logger`.
- `ingredient.controller.ts` khong import `notification.service` hoac `logger`.
- `notification.service.ts` khong import dish/ingredient/recommendation model interface.
- `contentNotification.service.ts` la noi duy nhat tao payload dish/ingredient.

Lenh goi y:

```powershell
rg "notificationService|logger" src\controllers\dish.controller.ts src\controllers\ingredient.controller.ts
rg "notifyDish|notifyIngredient|sendNotificationToAllUsers" src\services
```

### Dish

- Create dish thanh cong thi gui notification:
  - title: `Mon an moi!` hoac chuoi Vietnamese hien tai trong code.
  - data: `{ screen: 'DishDetail', dishId, action: 'CREATE' }`
- Update dish thanh cong thi gui silent notification:
  - title/body rong.
  - data action `UPDATE`.
- Delete dish thanh cong thi gui silent notification:
  - data action `DELETE`.
- Update/delete dish khong ton tai hoac da soft-delete:
  - tra `Dish not found`.
  - khong invalidate cache.
  - khong gui notification.

### Ingredient

- Create ingredient thanh cong thi gui notification:
  - screen `IngredientDetail`.
  - action `CREATE`.
- Update ingredient thanh cong thi gui silent notification:
  - action `UPDATE`.
- Delete ingredient thanh cong thi gui silent notification:
  - action `DELETE`.
- Neu DB mutation ingredient fail:
  - khong gui notification.
  - HTTP error van tra ve theo error middleware.

### Recommendation

- Recommendation job success van gui notification cho dung user.
- Loi push notification khong lam job fail.
- Job fail truoc buoc notification thi khong gui notification.

### Endpoint test notification

- `/users/test-notification` van goi duoc notification service truc tiep.
- Endpoint nay co the giu trong controller vi muc dich la test/debug.

## Lenh verify

Theo `package.json`, nen chay:

```powershell
corepack pnpm build
corepack pnpm lint
corepack pnpm db:generate
corepack pnpm test
```

Luu y hien tai:

- `corepack pnpm build`, `corepack pnpm lint`, `corepack pnpm db:generate` da tung chay pass sau thay doi truoc.
- `corepack pnpm test` phu thuoc Docker Desktop/Linux engine. Neu Docker chua chay se fail o buoc start Postgres test DB.
- `corepack pnpm prettier` repo-wide dang bi chan boi cac file `.history/**/*.ts` co syntax loi san co. Neu chi check file thay doi thi dung:

```powershell
corepack pnpm exec prettier --check src/controllers/dish.controller.ts src/controllers/ingredient.controller.ts src/services/dish.service.ts src/services/ingredient.service.ts src/services/notification.service.ts src/services/dishNotification.service.ts
```

## Ket luan

Nen gop o muc service nghiep vu, khong gop vao core notification transport.

Huong nen lam nhat cho codebase hien tai la:

- Doi `dishNotification.service.ts` thanh `contentNotification.service.ts`.
- Dua notification cua ingredient ra khoi controller va vao service nghiep vu nay.
- Giu `notification.service.ts` lam service ha tang duy nhat chiu trach nhiem Expo, token, logging, receipt cron.
