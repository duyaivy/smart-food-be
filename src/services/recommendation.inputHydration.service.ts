import prisma from '../client';
import logger from '../config/logger';
import {
  IFridgeEntry,
  IMealLogEntry,
  IRecommendationJobRequest,
  IRecommendationWorkerInput
} from '../models/interfaces/recommendation.interface';
import { calculateMaintenanceTdee } from '../utils/tdee';

const DEFAULT_WEIGHT_KG = 60;

const hydrateWorkerInput = async (
  body: IRecommendationJobRequest,
  userId: number
): Promise<IRecommendationWorkerInput> => {
  const { planDays, startDate, mealStructure, goal } = body;

  // 1. Fetch user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      weight: true,
      height: true,
      birthday: true,
      sex: true,
      activityLevel: true
    }
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const weight = user.weight ?? DEFAULT_WEIGHT_KG;

  // 2. Calculate TDEE
  const hasMissingBodyMetrics = !user.weight || !user.height || !user.birthday;

  if (hasMissingBodyMetrics) {
    logger.warn(
      `[RecommendationHydration] User ${userId} missing body metrics — using default profile values for TDEE calculation`
    );
  }

  const tdee = calculateMaintenanceTdee(user);

  // 3. Fetch fridge items active, non-expired
  const fridge = await prisma.fridge.findUnique({
    where: { userId },
    include: {
      items: {
        where: { deleteAt: null },
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              unit: true
            }
          }
        }
      }
    }
  });

  const fridgeEntries: IFridgeEntry[] = (fridge?.items ?? []).map((item) => ({
    ingredientId: item.ingredient.id,
    name: item.ingredient.name,
    quantity: item.quantity,
    unit: item.ingredient.unit,
    dueDate: item.dueDate.toISOString()
  }));

  // 4. Fetch recent meal logs last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentLogs = await prisma.mealLog.findMany({
    where: {
      userId,
      eatenAt: {
        gte: sevenDaysAgo
      }
    },
    select: {
      eatenAt: true,
      dishId: true
    },
    orderBy: {
      eatenAt: 'desc'
    },
    take: 30
  });

  const recentMealLog: IMealLogEntry[] = recentLogs.map((log) => ({
    dishId: log.dishId ?? 0,
    date: log.eatenAt.toISOString()
  }));

  return {
    userId,
    tdee,
    weight,
    goal,
    mealStructure,
    planDays,
    startDate,
    recentMealLog,
    fridge: fridgeEntries,
    lockedPicks: body.lockedPicks
  };
};

export default { hydrateWorkerInput };
