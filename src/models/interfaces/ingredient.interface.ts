import { Unit } from '@prisma/client';

export interface IIngredient {
  id: number;
  name: string;
  categoryId: number | null;
  description: string | null;
  protein: number | null;
  carb: number | null;
  fat: number | null;
  unit: Unit;
  images?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum IngredientSortBy {
  NAME = 'NAME',
  CREATED_AT = 'CREATED_AT'
}

export type CreateIngredientInput = {
  name: string;
  categoryId: number | null;
  description: string | null;
  protein: number | null;
  carb: number | null;
  fat: number | null;
  unit: Unit;
  images?: string[];
};

export type UpdateIngredientInput = Partial<CreateIngredientInput>;

export type IngredientListResult = {
  control: { total: number; page: number; limit: number };
  results: IIngredient[];
};
