import { RecommendationStatus } from '@prisma/client';

export interface IMealStructure {
  mainDish?: number;
  soup?: number;
  vegetable?: number;
}

export interface IGoal {
  targetKg: number;
}

export interface IRecommendationJobRequest {
  planDays: number;
  startDate: string;
  mealStructure: {
    breakfast?: IMealStructure;
    lunch?: IMealStructure;
    dinner?: IMealStructure;
  };
  goal: IGoal;
}

export interface IFridgeEntry {
  ingredientId: number;
  name: string;
  quantity: number;
  unit: string;
  dueDate: string;
}

export interface IMealLogEntry {
  mealType: string | null;
  eatenAt: string;
  dishId: number | null;
  dishName?: string | null;
  totalKcal: number | null;
}

export interface IRecommendationWorkerInput {
  userId: number;
  tdee: number;
  weight: number | null;
  goal: IGoal;
  mealStructure: {
    breakfast?: IMealStructure;
    lunch?: IMealStructure;
    dinner?: IMealStructure;
  };
  planDays: number;
  startDate: string;
  recentMealLog: IMealLogEntry[];
  fridge: IFridgeEntry[];
}

export type RecommendationRole = 'MAINDISH' | 'SOUP' | 'VEGETABLE';
export type RecommendationUnit = 'GAM' | 'NUMBER';

export interface IMissingIngredient {
  ingredientId: number;
  unit: RecommendationUnit;
  quantity: number;
}

export interface IMealDish {
  dishId: number;
  role: RecommendationRole;
  missingIngredient: IMissingIngredient[];
}

export interface IDayMeals {
  breakfast: IMealDish[];
  lunch: IMealDish[];
  dinner: IMealDish[];
}

export interface IDayNutrition {
  calories: number;
  protein: number;
  carb: number;
  fat: number;
}

export interface IPlanDay {
  day: number;
  date: string;
  meals: IDayMeals;
  nutrition: IDayNutrition;
}

export interface ISummary {
  avgDailyCalories: number;
  targetCalories: number;
  deviation: number;
  avgDailyProtein: number;
  avgDailyCarbs: number;
  avgDailyFat: number;
}

export interface IShoppingItem {
  ingredientId: number;
  quantity: number;
  unit: RecommendationUnit;
}

export interface IRecommendationOutput {
  status: 'SUCCESS' | 'FAILED';
  plan: IPlanDay[];
  summary: ISummary;
  shoppingList: IShoppingItem[];
}

export interface IRecommend {
  id: number;
  status: RecommendationStatus;
  userId: number;
  input: unknown;
  output: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecommendationJobResponse {
  jobId: number;
  status: RecommendationStatus;
  userId: number;
  input: unknown;
  output: IRecommendationOutput | null;
  createdAt: Date;
  updatedAt: Date;
}
