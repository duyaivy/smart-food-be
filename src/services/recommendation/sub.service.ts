import { DishType, Prisma } from '@prisma/client';
import prisma from '../../client';
import {
  IMissingIngredient,
  IRecommendationWorkerInput
} from '../../models/interfaces/recommendation.interface';

type DishIngredientWithIngredient = Prisma.DishIngredientGetPayload<{
  include: {
    ingredient: true;
  };
}>;

export type SubRecommendation = {
  dishId: number;
  role: DishType;
  name: string;
  calories: number | null;
  images: Prisma.JsonValue | null;
  missingIngredient: IMissingIngredient[];
};

const getMissingIngredients = (
  dishIngredients: DishIngredientWithIngredient[],
  fridgeList: { ingredientId: number; quantity: number }[]
): IMissingIngredient[] => {
  const missing: IMissingIngredient[] = [];
  for (const di of dishIngredients) {
    if (di.unit === 'SPOON') {
      continue;
    }
    const totalAvailable = fridgeList
      .filter((item) => item.ingredientId === di.ingredientId)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (totalAvailable < di.amount) {
      missing.push({
        ingredientId: di.ingredientId,
        unit: di.unit,
        quantity: Math.max(0, Number((di.amount - totalAvailable).toFixed(2)))
      });
    }
  }
  return missing;
};

/**
 * Find replacement dishes (by closest calories) for the given dish ids,
 * computing which ingredients are missing from the user's fridge.
 */
const getSubRecommendations = async (
  userId: number,
  dishIds: number[],
  jobId?: number
): Promise<{ originalDishId: number; recommendations: SubRecommendation[] }[]> => {
  // 1. Fetch user's fridge items
  let fridgeItems: { ingredientId: number; quantity: number }[] = [];
  if (jobId) {
    const job = await prisma.recommendation.findUnique({
      where: { id: jobId }
    });
    if (job && job.userId === userId && job.input) {
      const input = job.input as unknown as IRecommendationWorkerInput;
      if (input.fridge) {
        fridgeItems = input.fridge.map((entry) => ({
          ingredientId: entry.ingredientId,
          quantity: entry.quantity
        }));
      }
    }
  }

  if (fridgeItems.length === 0) {
    const fridge = await prisma.fridge.findUnique({
      where: { userId },
      include: {
        items: {
          where: { deleteAt: null }
        }
      }
    });
    if (fridge) {
      fridgeItems = fridge.items;
    }
  }

  const results: { originalDishId: number; recommendations: SubRecommendation[] }[] = [];

  for (const originalDishId of dishIds) {
    const originalDish = await prisma.dish.findUnique({
      where: { id: originalDishId }
    });

    if (!originalDish || originalDish.isDeleted) {
      continue;
    }

    const targetCalories = originalDish.calories ?? 0;

    // Use raw query to retrieve only the top 5 closest dishes directly from DB
    const top5Dishes = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Dish"
      WHERE "type" = ${originalDish.type}::"DishType"
        AND "id" <> ${originalDishId}
        AND "isDeleted" = false
        AND "calories" IS NOT NULL
      ORDER BY ABS("calories" - ${targetCalories}) ASC
      LIMIT 5
    `;

    const candidateIds = top5Dishes.map((d) => d.id);

    if (candidateIds.length === 0) {
      results.push({
        originalDishId,
        recommendations: []
      });
      continue;
    }

    // Now query the full data including ingredients for the top 5 candidates
    const candidates = await prisma.dish.findMany({
      where: {
        id: { in: candidateIds }
      },
      include: {
        ingredients: {
          include: {
            ingredient: true
          }
        }
      }
    });

    // Sort to keep the DB-ordered sequence (closest calories first)
    candidates.sort((a, b) => candidateIds.indexOf(a.id) - candidateIds.indexOf(b.id));

    const recommendations = candidates.map((candidate) => {
      const missingIngredients = getMissingIngredients(candidate.ingredients, fridgeItems);

      return {
        dishId: candidate.id,
        role: candidate.type,
        name: candidate.name,
        calories: candidate.calories,
        images: candidate.images,
        missingIngredient: missingIngredients
      };
    });

    results.push({
      originalDishId,
      recommendations
    });
  }

  return results;
};

export default { getSubRecommendations };
