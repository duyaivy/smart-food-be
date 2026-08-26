import prisma from '../client';
import { Category, Prisma } from '@prisma/client';
import ApiError from '../utils/apiError';
import httpStatus from 'http-status';

const getCategories = async (): Promise<Category[]> => {
  return prisma.category.findMany({
    where: { isDeleted: false },
    orderBy: { id: 'asc' }
  });
};

type CategoryWithIngredients = Prisma.CategoryGetPayload<{
  include: { ingredients: true };
}>;

const getCategoryById = async (id: number): Promise<CategoryWithIngredients | null> => {
  return prisma.category.findFirst({
    where: {
      id,
      isDeleted: false
    },
    include: {
      ingredients: true
    }
  });
};

const getCategoryByIdOrThrow = async (id: number): Promise<CategoryWithIngredients> => {
  const category = await getCategoryById(id);
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return category;
};

const ensureActiveCategoryExists = async (id: number): Promise<void> => {
  const category = await prisma.category.findFirst({
    where: { id, isDeleted: false },
    select: { id: true }
  });

  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }
};

const createCategory = async (data: { name: string; description?: string }): Promise<Category> => {
  return prisma.category.create({
    data: {
      name: data.name,
      description: data.description
    }
  });
};

const updateCategory = async (
  id: number,
  data: { name?: string; description?: string }
): Promise<Category> => {
  await ensureActiveCategoryExists(id);

  return prisma.category.update({
    where: { id },
    data
  });
};

const deleteCategory = async (id: number): Promise<Category> => {
  await ensureActiveCategoryExists(id);

  return prisma.category.update({
    where: { id },
    data: { isDeleted: true }
  });
};

export default {
  getCategories,
  getCategoryById,
  getCategoryByIdOrThrow,
  ensureActiveCategoryExists,
  createCategory,
  updateCategory,
  deleteCategory
};
