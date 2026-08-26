import { MealType } from '@prisma/client';

export type NutritionMacro = {
  calories: number;
  protein: number;
  carb: number;
  fat: number;
};

export type DailyMealNutrition = NutritionMacro & {
  mealType: MealType | null;
};

export type DailyNutritionResult = {
  date: string;
  total: NutritionMacro;
  meals: DailyMealNutrition[];
};

export type WeeklyDailyTotal = NutritionMacro & {
  date: string;
};

export type WeeklyNutritionResult = {
  week: string;
  weeklyTotal: NutritionMacro;
  dailyAverage: NutritionMacro;
  dailyTotals: WeeklyDailyTotal[];
};

export type RemainingNutritionResult = {
  date: string;
  remaining: NutritionMacro;
  percentageConsumed: NutritionMacro;
};
