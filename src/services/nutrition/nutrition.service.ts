import { MealType } from '@prisma/client';

import prisma from '../../client';
import { roundNutrition } from '../../utils/calc';
import {
  formatDateInVietnamTimezone,
  getIsoWeekDateRange,
  getVietnamDateRange,
  getWeekDateStrings
} from '../../utils/date';
import userMetricService from '../user/userMetric.service';
import {
  DailyNutritionResult,
  NutritionMacro,
  RemainingNutritionResult,
  WeeklyNutritionResult
} from '../../models/interfaces/nutrition.interface';

const emptyNutritionMacro = (): NutritionMacro => ({
  calories: 0,
  protein: 0,
  carb: 0,
  fat: 0
});

const addNutritionMacro = (target: NutritionMacro, source: NutritionMacro) => {
  target.calories = roundNutrition(target.calories + source.calories);
  target.protein = roundNutrition(target.protein + source.protein);
  target.carb = roundNutrition(target.carb + source.carb);
  target.fat = roundNutrition(target.fat + source.fat);
};

const mapMealLogToNutritionMacro = (mealLog: {
  totalKcal: number | null;
  totalProtein: number | null;
  totalCarb: number | null;
  totalFat: number | null;
}): NutritionMacro => ({
  calories: roundNutrition(mealLog.totalKcal ?? 0),
  protein: roundNutrition(mealLog.totalProtein ?? 0),
  carb: roundNutrition(mealLog.totalCarb ?? 0),
  fat: roundNutrition(mealLog.totalFat ?? 0)
});

const getDailyNutrition = async (userId: number, date: string): Promise<DailyNutritionResult> => {
  const { startDate, endDate } = getVietnamDateRange(date);

  const mealLogs = await prisma.mealLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lt: endDate
      }
    },
    select: {
      mealType: true,
      totalKcal: true,
      totalProtein: true,
      totalCarb: true,
      totalFat: true
    }
  });

  const total = emptyNutritionMacro();
  const mealNutritionByType = new Map<MealType | null, NutritionMacro>();

  for (const mealLog of mealLogs) {
    const mealType = mealLog.mealType ?? null;
    const nutrition = mapMealLogToNutritionMacro(mealLog);

    addNutritionMacro(total, nutrition);

    const currentMealNutrition = mealNutritionByType.get(mealType) ?? emptyNutritionMacro();
    addNutritionMacro(currentMealNutrition, nutrition);
    mealNutritionByType.set(mealType, currentMealNutrition);
  }

  const meals = Array.from(mealNutritionByType.entries()).map(([mealType, nutrition]) => ({
    mealType,
    ...nutrition
  }));

  return {
    date,
    total,
    meals
  };
};

const getWeeklyNutrition = async (userId: number, week: string): Promise<WeeklyNutritionResult> => {
  const { startDateString, startDate, endDate } = getIsoWeekDateRange(week);
  const weekDateStrings = getWeekDateStrings(startDateString);

  const dailyNutritionByDate = new Map<string, NutritionMacro>(
    weekDateStrings.map((date) => [date, emptyNutritionMacro()])
  );

  const mealLogs = await prisma.mealLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lt: endDate
      }
    },
    select: {
      createdAt: true,
      totalKcal: true,
      totalProtein: true,
      totalCarb: true,
      totalFat: true
    }
  });

  for (const mealLog of mealLogs) {
    const date = formatDateInVietnamTimezone(mealLog.createdAt);
    const currentDailyNutrition = dailyNutritionByDate.get(date);

    if (!currentDailyNutrition) {
      continue;
    }

    addNutritionMacro(currentDailyNutrition, mapMealLogToNutritionMacro(mealLog));
    dailyNutritionByDate.set(date, currentDailyNutrition);
  }

  const dailyTotals = weekDateStrings.map((date) => ({
    date,
    ...(dailyNutritionByDate.get(date) ?? emptyNutritionMacro())
  }));

  const weeklyTotal = dailyTotals.reduce((total, dailyTotal) => {
    addNutritionMacro(total, dailyTotal);
    return total;
  }, emptyNutritionMacro());

  const dailyAverage = {
    calories: roundNutrition(weeklyTotal.calories / 7),
    protein: roundNutrition(weeklyTotal.protein / 7),
    carb: roundNutrition(weeklyTotal.carb / 7),
    fat: roundNutrition(weeklyTotal.fat / 7)
  };

  return {
    week,
    weeklyTotal,
    dailyAverage,
    dailyTotals
  };
};

const getDailyRemainingNutrition = async (
  userId: number,
  date: string
): Promise<RemainingNutritionResult> => {
  const [dailyNutrition, target] = await Promise.all([
    getDailyNutrition(userId, date),
    userMetricService.getDefaultDailyMacroTarget(userId)
  ]);
  const consumed = dailyNutrition.total;

  const remaining = {
    calories: roundNutrition(Math.max(target.calories - consumed.calories, 0)),
    protein: roundNutrition(Math.max(target.protein - consumed.protein, 0)),
    carb: roundNutrition(Math.max(target.carb - consumed.carb, 0)),
    fat: roundNutrition(Math.max(target.fat - consumed.fat, 0))
  };

  const percentageConsumed = {
    calories: target.calories > 0 ? roundNutrition((consumed.calories / target.calories) * 100) : 0,
    protein: target.protein > 0 ? roundNutrition((consumed.protein / target.protein) * 100) : 0,
    carb: target.carb > 0 ? roundNutrition((consumed.carb / target.carb) * 100) : 0,
    fat: target.fat > 0 ? roundNutrition((consumed.fat / target.fat) * 100) : 0
  };

  return {
    date,
    remaining,
    percentageConsumed
  };
};

export default {
  getDailyNutrition,
  getWeeklyNutrition,
  getDailyRemainingNutrition
};
