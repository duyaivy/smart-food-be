import prisma from '../client';
import logger from '../config/logger';
import {
  IFridgeEntry,
  IMealLogEntry,
  IRecommendationJobRequest,
  IRecommendationWorkerInput
} from '../models/interfaces/recommendation.interface';

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9
};

/**
 * Mifflin-St Jeor formula
 * Male:   BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) + 5
 * Female: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) - 161
 */
const calculateTDEE = (
  weight: number,
  height: number,
  birthdayISO: string,
  sex: boolean, // true = male
  activityLevel: string
): number => {
  const ageDays = (Date.now() - new Date(birthdayISO).getTime()) / (1000 * 60 * 60 * 24);
  const age = Math.floor(ageDays / 365.25);

  const bmr = sex
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
  return Math.round(bmr * multiplier);
};

const DEFAULT_WEIGHT_KG = 60;
const DEFAULT_HEIGHT_CM = 165;
const DEFAULT_BIRTHDAY = '1990-01-01T00:00:00.000Z';
const DEFAULT_TDEE = 2000;

const hydrateWorkerInput = async (
  body: IRecommendationJobRequest,
  userId: number
): Promise<IRecommendationWorkerInput> => {
  const { planDays, startDate, mealStructure, goal } = body;

  // 1. Fetch user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { weight: true, height: true, birthday: true, sex: true, activityLevel: true }
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const weight = user.weight ?? DEFAULT_WEIGHT_KG;
  const height = user.height ?? DEFAULT_HEIGHT_CM;
  const birthday = user.birthday ? user.birthday.toISOString() : DEFAULT_BIRTHDAY;
  const activityLevel = user.activityLevel ?? 'SEDENTARY';
  const sex = user.sex ?? true;

  // 2. Calculate TDEE
  let tdee: number;
  if (user.weight && user.height && user.birthday) {
    tdee = calculateTDEE(weight, height, birthday, sex, String(activityLevel));
  } else {
    logger.warn(
      `[RecommendationHydration] User ${userId} missing body metrics — using default TDEE ${DEFAULT_TDEE}`
    );
    tdee = DEFAULT_TDEE;
  }

  // 3. Fetch fridge items (active, non-expired)
  const fridge = await prisma.fridge.findUnique({
    where: { userId },
    include: {
      items: {
        where: { deleteAt: null },
        include: { ingredient: { select: { id: true, name: true, unit: true } } }
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

  // 4. Fetch recent meal logs (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentLogs = await prisma.mealLog.findMany({
    where: {
      userId,
      eatenAt: { gte: sevenDaysAgo }
    },
    select: {
      mealType: true,
      eatenAt: true,
      dishId: true,
      totalKcal: true,
      dish: { select: { name: true } }
    },
    orderBy: { eatenAt: 'desc' },
    take: 30
  });

  const recentMealLog: IMealLogEntry[] = recentLogs.map((log) => ({
    mealType: log.mealType ?? null,
    eatenAt: log.eatenAt.toISOString(),
    dishId: log.dishId ?? null,
    dishName: log.dish?.name ?? null,
    totalKcal: log.totalKcal ?? null
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
    fridge: fridgeEntries
  };
};

export default { hydrateWorkerInput };
