import { Difficulty } from '@prisma/client';

export { Difficulty };

export interface Instruction {
  title: string;
  content: string;
}

export type CreateDishInput = {
  name: string;
  instructions?: Instruction[];
  images?: string[];
  description?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  difficulty: Difficulty;
};

export interface IDish {
  id: number;
  name: string;
  instructions?: Instruction[];
  images?: string[];
  description?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  difficulty: Difficulty;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDishIngredient {
  // thành phần la nguyen lieu tho
  id: number;
  dishId: number;
  ingredientId: number;
  amount: number;
  unit: string;
  gramsEquivalent: number;
}

export enum DishSortBy {
  NAME = 'NAME',
  PREP_TIME = 'PREP_TIME',
  COOK_TIME = 'COOK_TIME',
  CREATED_AT = 'CREATED_AT'
}
