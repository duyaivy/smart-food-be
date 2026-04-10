import prisma from '../client';
import { Category } from '@prisma/client';
import ApiError from '../utils/apiError';
import httpStatus from 'http-status';

const getCategories = async (): Promise<Category[]> => {
  return prisma.category.findMany({
    where: { isDeleted: false },
    orderBy: { id: 'asc' }
  });
};

const getCategoryById = async (id: number): Promise<Category | null> => {
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
  const category = await getCategoryById(id);
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return prisma.category.update({
    where: { id },
    data
  });
};

const deleteCategory = async (id: number): Promise<Category> => {
  const category = await getCategoryById(id);
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return prisma.category.update({
    where: { id },
    data: { isDeleted: true }
  });
};

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
