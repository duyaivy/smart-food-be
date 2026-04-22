import { Ingredient, Priority, FridgeTransactionType } from '@prisma/client';

export interface IFridge {
  id: number;
  userId: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFridgeItem {
  id: number;
  fridgeId: number;
  ingredientId: number;
  dueDate: Date;
  priority: Priority;
  quantity: number;
  deleteAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFridgeTransaction {
  id: number;
  fridgeId: number;
  type: FridgeTransactionType;
  note: string | null;
  createdAt: Date;
}

export enum FridgeItemSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  DUE_DATE = 'DUE_DATE',
  QUANTITY = 'QUANTITY',
  PRIORITY = 'PRIORITY'
}

export type CreateFridgeItemInput = {
  ingredientId: number;
  quantity: number;
  dueDate: string;
  priority: Priority;
};

export type CreateFridgeItemFromScanInput = {
  ingredientId: number;
  quantity: number;
  dueDate: string;
  priority: Priority;
  deviceUid?: string;
};

export type UpdateFridgeItemInput = Partial<{
  quantity: number;
  dueDate: string;
  priority: Priority;
}>;

export type GetFridgeItemsFilter = {
  keyword?: string;
  priority?: Priority;
  isExpired?: boolean;
};

export type GetFridgeItemsOptions = {
  sortBy?: FridgeItemSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  page?: number;
};

// fix: thêm options pagination cho getFridgeTransactions
export type GetFridgeTransactionsOptions = {
  limit?: number;
  page?: number;
};

export interface IFridgeItemWithIngredient extends IFridgeItem {
  ingredient: Ingredient;
}

export type FridgeItemListResult = {
  control: {
    total: number;
    page: number;
    limit: number;
  };
  results: IFridgeItemWithIngredient[];
};

export type FridgeTransactionListResult = {
  control: {
    total: number;
    page: number;
    limit: number;
  };
  results: IFridgeTransaction[];
};
