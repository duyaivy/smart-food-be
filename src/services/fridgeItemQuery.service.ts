import { Prisma } from '@prisma/client';
import {
  FridgeItemSortBy,
  GetFridgeItemsFilter,
  GetFridgeItemsOptions
} from '../models/interfaces/fridge.interface';

const fridgeItemSortFieldMap: Record<
  FridgeItemSortBy,
  keyof Prisma.FridgeItemOrderByWithRelationInput
> = {
  [FridgeItemSortBy.CREATED_AT]: 'createdAt',
  [FridgeItemSortBy.UPDATED_AT]: 'updatedAt',
  [FridgeItemSortBy.DUE_DATE]: 'dueDate',
  [FridgeItemSortBy.QUANTITY]: 'quantity',
  [FridgeItemSortBy.PRIORITY]: 'priority'
};

const buildFridgeItemWhere = (
  fridgeId: number,
  filter: GetFridgeItemsFilter,
  now: Date
): Prisma.FridgeItemWhereInput => {
  const { keyword, priority, isExpired } = filter;

  return {
    fridgeId,
    deleteAt: null,
    ...(priority ? { priority } : {}),
    ...(keyword
      ? {
          ingredient: {
            name: {
              contains: keyword,
              mode: 'insensitive'
            }
          }
        }
      : {}),
    ...(isExpired !== undefined
      ? isExpired
        ? { dueDate: { lt: now } }
        : { dueDate: { gte: now } }
      : {})
  };
};

const buildFridgeItemOrderBy = (
  sortBy: FridgeItemSortBy = FridgeItemSortBy.CREATED_AT,
  sortOrder: Prisma.SortOrder = 'desc'
): Prisma.FridgeItemOrderByWithRelationInput => {
  const orderByField = fridgeItemSortFieldMap[sortBy] ?? fridgeItemSortFieldMap.CREATED_AT;

  return {
    [orderByField]: sortOrder
  };
};

const normalizePagination = (
  options: Pick<GetFridgeItemsOptions, 'limit' | 'page'>,
  defaultLimit = 10
) => ({
  limit: options.limit ?? defaultLimit,
  page: options.page ?? 1
});

export default {
  buildFridgeItemWhere,
  buildFridgeItemOrderBy,
  normalizePagination
};
