# AI Prompt for Implementing Sub-Recommendation Feature

**Objective:**  
Enhance the existing `recommendation` route in the system to include a **sub-recommendation feature** that allows users to swap a dish in an existing daily meal plan with alternatives of similar calorie content. Implement both GET and POST endpoints and ensure proper handling of database updates using Prisma.

---

## Instructions for AI

1. Carefully read the uploaded `overview` file to understand the **folder structure**, current **API routes**, and **Prisma schema**.
2. Extend the `recommendation` feature to add a **sub-recommendation API** with the following requirements:
   - **Endpoint 1:** `POST /sub-recommendation`
     - Input: array of `dishId`s representing dishes user wants to replace.
     - Function: Query database and return **top 5 dishes** that have similar calorie and similar DishType content to each input dish.
     - Output: Return a JSON array with recommended dishes in a format consistent with existing `recommendation.output`.
   - **Endpoint 2:** `POST /sub-recommendation/confirm`
     - Input: the dish selection confirmed by the user to replace the original dish.
     - Function: Update the `Recommendation.output` in the database with the new dish and update all related nutritional values (calories, protein, fat, carb) accordingly.
     - Ensure Prisma operations are **atomic** and handle potential errors gracefully.
3. Ensure compatibility with existing Prisma models:
```prisma
model Recommendation {
id Int @id @default(autoincrement())
status RecommendationStatus
userId Int
input Json
output Json?
message String?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
user User @relation(fields: [userId], references: [id], onDelete: Cascade)

@@index([userId])
@@index([createdAt])
}

model Dish {
id Int @id @default(autoincrement())
name String
prepTimeMin Int?
cookTimeMin Int?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
difficulty Difficulty
description String?
instructions Json?
images String[]
calories Float?
isDeleted Boolean @default(false)
type DishType @default(MAIN_DISH)
ingredients DishIngredient[]
mealLogs MealLog[]
}

enum DishType {
MAIN_DISH
VEGETABLE
SOUP
}
```
/```json
{
  "plan": [
    {
      "day": 1,
      "date": "2026-05-09T05:07:46.129000Z",
      "meals": {
        "lunch": [
          {
            "role": "MAINDISH",
            "dishId": 2,
            "missingIngredient": [
              {"unit": "NUMBER", "quantity": 1, "ingredientId": 46},
              {"unit": "NUMBER", "quantity": 3, "ingredientId": 68}
            ]
          }
        ]
      },
      "nutrition": {"fat": 26.6, "carb": 132.3, "protein": 83.2, "calories": 1160}
    }
  ]
}
/```
5. Design the logic for **sub-recommendation ranking**:
   - Compute **absolute difference of calories** between the original dish and candidate dishes.
   - Sort candidates by smallest difference.
   - Return **top 5 closest dishes** per requested dish.

6. Make sure all **inner code blocks** use **/```** (as shown above) for consistency.

7. Ensure endpoints handle **missing or insufficient ingredients** gracefully, similar to the existing recommendation logic.

---
