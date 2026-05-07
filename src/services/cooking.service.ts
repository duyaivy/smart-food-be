import httpStatus from 'http-status';
import { CookingStatus, Prisma } from '@prisma/client';
import prisma from '../client';
import ApiError from '../utils/apiError';
import {
  CreateCookingInput,
  CookingListResult,
  CookingSortBy,
  GetCookingsFilter,
  GetCookingsOptions
} from '../models/interfaces/cooking.interface';

const cookingSelect = {
  id: true,
  userId: true,
  dishId: true,
  status: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CookingSelect;

const cookingListSelect = {
  ...cookingSelect,
  dish: {
    select: {
      id: true,
      name: true,
      images: true,
      prepTimeMin: true,
      cookTimeMin: true,
      calories: true
    }
  }
} satisfies Prisma.CookingSelect;

const cookingDetailSelect = {
  ...cookingSelect,
  dish: {
    select: {
      id: true,
      name: true,
      prepTimeMin: true,
      cookTimeMin: true,
      description: true,
      instructions: true,
      images: true,
      calories: true,
      difficulty: true,
      type: true
    }
  }
} satisfies Prisma.CookingSelect;

type CookingBase = Prisma.CookingGetPayload<{
  select: typeof cookingSelect;
}>;

type CookingListItem = Prisma.CookingGetPayload<{
  select: typeof cookingListSelect;
}>;

type CookingDetail = Prisma.CookingGetPayload<{
  select: typeof cookingDetailSelect;
}>;

const validateDishExists = async (dishId: number) => {
  const dish = await prisma.dish.findFirst({
    where: {
      id: dishId,
      isDeleted: false
    },
    select: {
      id: true
    }
  });

  if (!dish) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Món ăn không tồn tại');
  }

  return dish;
};

const calculateDurationMinutes = (startedAt: Date, endedAt: Date): number => {
  const durationMs = endedAt.getTime() - startedAt.getTime();

  return Math.max(0, Math.floor(durationMs / 60000));
};

const getCookingByUser = async (userId: number, cookingId: number): Promise<CookingDetail> => {
  const cooking = await prisma.cooking.findFirst({
    where: {
      id: cookingId,
      userId
    },
    select: cookingDetailSelect
  });

  if (!cooking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Phiên nấu ăn không tồn tại');
  }

  return cooking;
};

const getCookingBaseByUser = async (userId: number, cookingId: number): Promise<CookingBase> => {
  const cooking = await prisma.cooking.findFirst({
    where: {
      id: cookingId,
      userId
    },
    select: cookingSelect
  });

  if (!cooking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Phiên nấu ăn không tồn tại');
  }

  return cooking;
};

const createCooking = async (
  userId: number,
  payload: CreateCookingInput
): Promise<CookingListItem> => {
  const { dishId } = payload;

  await validateDishExists(dishId);

  return prisma.cooking.create({
    data: {
      userId,
      dishId,
      status: CookingStatus.IN_PROGRESS
    },
    select: cookingListSelect
  });
};

const getCookings = async (
  userId: number,
  filter: GetCookingsFilter,
  options: GetCookingsOptions
): Promise<CookingListResult<CookingListItem>> => {
  const { sortBy = CookingSortBy.CREATED_AT, sortOrder = 'desc', limit = 10, page = 1 } = options;

  const orderByField = (() => {
    switch (sortBy) {
      case CookingSortBy.UPDATED_AT:
        return 'updatedAt';
      case CookingSortBy.STARTED_AT:
        return 'startedAt';
      case CookingSortBy.ENDED_AT:
        return 'endedAt';
      case CookingSortBy.DURATION_MINUTES:
        return 'durationMinutes';
      case CookingSortBy.CREATED_AT:
      default:
        return 'createdAt';
    }
  })();

  const whereClause: Prisma.CookingWhereInput = {
    userId,
    ...(filter.status && filter.status.length > 0
      ? {
          status: {
            in: filter.status
          }
        }
      : {})
  };

  const [results, total] = await Promise.all([
    prisma.cooking.findMany({
      where: whereClause,
      select: cookingListSelect,
      orderBy: {
        [orderByField]: sortOrder
      },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.cooking.count({
      where: whereClause
    })
  ]);

  return {
    control: {
      total,
      page,
      limit
    },
    results
  };
};

const getCookingById = async (userId: number, cookingId: number): Promise<CookingDetail> => {
  return getCookingByUser(userId, cookingId);
};

const completeCooking = async (userId: number, cookingId: number): Promise<CookingBase> => {
  const cooking = await getCookingBaseByUser(userId, cookingId);

  if (cooking.status !== CookingStatus.IN_PROGRESS) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Chỉ có thể hoàn thành phiên nấu ăn đang diễn ra');
  }

  const endedAt = new Date();
  const durationMinutes = calculateDurationMinutes(cooking.startedAt, endedAt);

  return prisma.cooking.update({
    where: {
      id: cooking.id
    },
    data: {
      status: CookingStatus.COMPLETED,
      endedAt,
      durationMinutes
    },
    select: cookingSelect
  });
};

const cancelCooking = async (userId: number, cookingId: number): Promise<CookingBase> => {
  const cooking = await getCookingBaseByUser(userId, cookingId);

  if (cooking.status !== CookingStatus.IN_PROGRESS) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Chỉ có thể hủy phiên nấu ăn đang diễn ra');
  }

  const endedAt = new Date();
  const durationMinutes = calculateDurationMinutes(cooking.startedAt, endedAt);

  return prisma.cooking.update({
    where: {
      id: cooking.id
    },
    data: {
      status: CookingStatus.CANCELLED,
      endedAt,
      durationMinutes
    },
    select: cookingSelect
  });
};

export default {
  createCooking,
  getCookings,
  getCookingById,
  completeCooking,
  cancelCooking
};
