-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "FridgeTransactionType" AS ENUM ('PURCHASE', 'COOK', 'ADJUST', 'DISCARD', 'EXPIRE', 'IMPORT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "age" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER,
    "desciption" TEXT,
    "protein" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'gam',
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "images" TEXT,
    "prepTimeMin" INTEGER,
    "cookTimeMin" INTEGER,
    "difficulty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishIngredient" (
    "id" SERIAL NOT NULL,
    "dishId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "gramsEquivalent" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DishIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eatenAt" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT,
    "note" TEXT,
    "dishId" INTEGER,
    "totalKcal" DOUBLE PRECISION,
    "totalProtein" DOUBLE PRECISION,
    "totalCarbs" DOUBLE PRECISION,
    "totalFat" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealLogIngredientSnapshot" (
    "id" SERIAL NOT NULL,
    "mealLogId" INTEGER NOT NULL,
    "ingredientId" INTEGER,
    "ingredientName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "gramsEquivalent" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLogIngredientSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fridge" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Fridge',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fridge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FridgeItem" (
    "id" SERIAL NOT NULL,
    "fridgeId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FridgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FridgeTransaction" (
    "id" SERIAL NOT NULL,
    "fridgeId" INTEGER NOT NULL,
    "type" "FridgeTransactionType" NOT NULL,
    "note" TEXT,
    "relatedDishId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FridgeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER,
    "deviceUid" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "token" TEXT NOT NULL,
    "UserId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DishIngredient_dishId_idx" ON "DishIngredient"("dishId");

-- CreateIndex
CREATE INDEX "DishIngredient_ingredientId_idx" ON "DishIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "MealLog_userId_idx" ON "MealLog"("userId");

-- CreateIndex
CREATE INDEX "MealLog_dishId_idx" ON "MealLog"("dishId");

-- CreateIndex
CREATE INDEX "MealLog_eatenAt_idx" ON "MealLog"("eatenAt");

-- CreateIndex
CREATE INDEX "MealLogIngredientSnapshot_mealLogId_idx" ON "MealLogIngredientSnapshot"("mealLogId");

-- CreateIndex
CREATE INDEX "Fridge_userId_idx" ON "Fridge"("userId");

-- CreateIndex
CREATE INDEX "FridgeItem_fridgeId_idx" ON "FridgeItem"("fridgeId");

-- CreateIndex
CREATE INDEX "FridgeItem_ingredientId_idx" ON "FridgeItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "FridgeItem_fridgeId_ingredientId_key" ON "FridgeItem"("fridgeId", "ingredientId");

-- CreateIndex
CREATE INDEX "FridgeTransaction_fridgeId_idx" ON "FridgeTransaction"("fridgeId");

-- CreateIndex
CREATE INDEX "FridgeTransaction_relatedDishId_idx" ON "FridgeTransaction"("relatedDishId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceUid_key" ON "Device"("deviceUid");

-- CreateIndex
CREATE INDEX "Device_ownerId_idx" ON "Device"("ownerId");

-- CreateIndex
CREATE INDEX "RefreshToken_UserId_idx" ON "RefreshToken"("UserId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLogIngredientSnapshot" ADD CONSTRAINT "MealLogIngredientSnapshot_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "MealLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLogIngredientSnapshot" ADD CONSTRAINT "MealLogIngredientSnapshot_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fridge" ADD CONSTRAINT "Fridge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FridgeItem" ADD CONSTRAINT "FridgeItem_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FridgeItem" ADD CONSTRAINT "FridgeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FridgeTransaction" ADD CONSTRAINT "FridgeTransaction_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FridgeTransaction" ADD CONSTRAINT "FridgeTransaction_relatedDishId_fkey" FOREIGN KEY ("relatedDishId") REFERENCES "Dish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
