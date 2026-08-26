import { MealType, Unit } from '@prisma/client';

export enum MealHistorySortBy {
  CREATED_AT = 'CREATED_AT'
}

export type MealIngredientInput = {
  ingredientId: number;
  amount: number;
  unit: Unit;
  gramsEquivalent: number;
};

export type CreateMealInput = {
  dishId?: number;
  customName?: string;
  mealType?: MealType;
  note?: string;
  eatenAt?: Date;
  missingIngredientIds?: number[];
  allowMissingIngredients?: boolean;
  customIngredients?: MealIngredientInput[];
};

export type GetMealHistoryFilter = {
  dishId?: number;
  fromDate?: Date;
  toDate?: Date;
};

export type GetMealHistoryOptions = {
  sortBy?: MealHistorySortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  page?: number;
};

export type MealListResult<T> = {
  control: {
    total: number;
    page: number;
    limit: number;
  };
  results: T[];
};
