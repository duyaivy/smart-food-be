import { RecommendationStatus, DishType, MealType, Unit } from '@prisma/client';

export interface IMealStructure {
  mainDish?: number;
  soup?: number;
  vegetable?: number;
}

export interface IGoal {
  targetKg: number;
}

export interface ChangeDish {
  day: number;
  meal: MealType;
  role: DishType;
  dishId: number;
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
  lockedPicks?: ChangeDish[];
}

export interface IFridgeEntry {
  ingredientId: number;
  name: string;
  quantity: number;
  unit: string;
  dueDate: string;
}

export interface IMealLogEntry {
  mealType: MealType | null;
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
  lockedPicks?: ChangeDish[];
}

export type RecommendationRole = DishType;

export interface IMissingIngredient {
  ingredientId: number;
  unit: Unit;
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
  unit: Unit;
}

export interface IRecommendationOutput {
  status: RecommendationStatus;
  plan: IPlanDay[];
  summary: ISummary;
  message?: string;
  shoppingList: IShoppingItem[];
}

export interface IRecommendationJobResponse {
  jobId: number;
  status: RecommendationStatus;
  userId: number;
  input: IRecommendationWorkerInput | null;
  output: IRecommendationOutput | null;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}
