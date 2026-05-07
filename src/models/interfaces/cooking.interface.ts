import { MealType, Unit } from '@prisma/client';

export enum CookingHistorySortBy {
  EATEN_AT = 'EATEN_AT',
  CREATED_AT = 'CREATED_AT'
}

export type CookingIngredientInput = {
  ingredientId: number;
  amount: number;
  unit: Unit;
  gramsEquivalent: number;
};

export type CreateCookingInput = {
  dishId: number;
  eatenAt: string;
  mealType?: MealType;
  note?: string;
  ingredients: CookingIngredientInput[];
};

export type GetCookingHistoryFilter = {
  dishId?: number;
  fromDate?: Date;
  toDate?: Date;
};

export type GetCookingHistoryOptions = {
  sortBy?: CookingHistorySortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  page?: number;
};

export type CookingListResult<T> = {
  control: {
    total: number;
    page: number;
    limit: number;
  };
  results: T[];
};
