import { Prisma, Unit } from '@prisma/client';
import { calculateIngredientNutrition, roundNutrition } from '../utils/calc';
import { IMealDish, IPlanDay, IShoppingItem } from '../models/interfaces/recommendation.interface';

/**
 * Nutrition + shopping-list helpers for recommendation plans.
 * Kept separate from job/queue/AI concerns so the plan math is testable
 * in isolation and reusable from any plan mutation.
 */

const calculateDishesNutrition = async (tx: Prisma.TransactionClient, dishIds: number[]) => {
  if (dishIds.length === 0) {
    return { calories: 0, protein: 0, carb: 0, fat: 0 };
  }

  const dishes = await tx.dish.findMany({
    where: { id: { in: dishIds } },
    include: {
      ingredients: {
        include: {
          ingredient: true
        }
      }
    }
  });

  let calories = 0;
  let protein = 0;
  let carb = 0;
  let fat = 0;

  for (const dishId of dishIds) {
    const dish = dishes.find((d) => d.id === dishId);
    if (dish) {
      let dishCal = dish.calories ?? 0;
      let dishProtein = 0;
      let dishCarb = 0;
      let dishFat = 0;
      let calculatedCal = 0;

      for (const di of dish.ingredients) {
        const nut = calculateIngredientNutrition(di.ingredient, di.gramsEquivalent);
        dishProtein += nut.protein;
        dishCarb += nut.carb;
        dishFat += nut.fat;
        calculatedCal += nut.kcal;
      }

      if (!dishCal) {
        dishCal = calculatedCal;
      }

      calories += dishCal;
      protein += dishProtein;
      carb += dishCarb;
      fat += dishFat;
    }
  }

  return {
    calories: roundNutrition(calories),
    protein: roundNutrition(protein),
    carb: roundNutrition(carb),
    fat: roundNutrition(fat)
  };
};

const rebuildShoppingList = (plan: IPlanDay[]): IShoppingItem[] => {
  const shoppingMap = new Map<string, { ingredientId: number; unit: Unit; quantity: number }>();
  const processMeals = (dishes: IMealDish[]) => {
    for (const md of dishes) {
      for (const mi of md.missingIngredient) {
        if (mi.unit === 'SPOON') {
          continue;
        }
        const key = `${mi.ingredientId}_${mi.unit}`;
        const existing = shoppingMap.get(key);
        if (existing) {
          existing.quantity += mi.quantity;
        } else {
          shoppingMap.set(key, {
            ingredientId: mi.ingredientId,
            unit: mi.unit,
            quantity: mi.quantity
          });
        }
      }
    }
  };

  for (const d of plan) {
    processMeals(d.meals.breakfast || []);
    processMeals(d.meals.lunch || []);
    processMeals(d.meals.dinner || []);
  }

  return Array.from(shoppingMap.values()).map((item) => ({
    ingredientId: item.ingredientId,
    unit: item.unit,
    quantity: roundNutrition(item.quantity)
  }));
};

export default { calculateDishesNutrition, rebuildShoppingList };
