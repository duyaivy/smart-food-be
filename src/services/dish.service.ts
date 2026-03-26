import prisma from '../client';
import { CreateDishInput, Difficulty } from '../interfaces/dish.interface';
import { Dish, Prisma } from '@prisma/client';

const createDish = async (dish: CreateDishInput): Promise<Dish> => {
  const { prepTimeMin, cookTimeMin, difficulty, name, images, instructions, description } = dish;
  return prisma.dish.create({
    data: {
      name,
      difficulty,
      ...(description !== undefined ? { description } : {}),
      ...(prepTimeMin !== undefined ? { prepTimeMin } : {}),
      ...(cookTimeMin !== undefined ? { cookTimeMin } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(instructions !== undefined
        ? { instructions: instructions as unknown as Prisma.InputJsonValue }
        : {})
    }
  });
};
const updateDish = async (dishId: number, updateData: Partial<CreateDishInput>): Promise<Dish> => {
  const { prepTimeMin, cookTimeMin, difficulty, name, images, instructions, description } =
    updateData;
  return prisma.dish.update({
    where: { id: dishId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(difficulty !== undefined ? { difficulty } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(prepTimeMin !== undefined ? { prepTimeMin } : {}),
      ...(cookTimeMin !== undefined ? { cookTimeMin } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(instructions !== undefined
        ? { instructions: instructions as unknown as Prisma.InputJsonValue }
        : {})
    }
  });
};
const getDishes = async (
  filter: { name?: string; difficulty?: Difficulty },
  options: { sortBy?: string; limit?: number; page?: number }
) => {
  const { name, difficulty } = filter;
  const { sortBy = 'createdAt', limit = 10, page = 1 } = options;
  const whereClause: Prisma.DishWhereInput = {
    ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
    ...(difficulty ? { difficulty } : {})
  };
  const dishes = await prisma.dish.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      prepTimeMin: true,
      cookTimeMin: true,
      description: true,
      difficulty: true,
      images: true
    },
    orderBy: [{ [sortBy]: 'desc' }],
    skip: (page - 1) * limit,
    take: limit
  });
  const total = await prisma.dish.count({ where: whereClause });
  const control = {
    total,
    page,
    limit
  };
  return {
    control,
    results: dishes
  };
};
type DishWithIngredients = Prisma.DishGetPayload<{
  include: { ingredients: { include: { ingredient: true } } };
}>;

const getDishById = async (dishId: number): Promise<DishWithIngredients | null> => {
  return prisma.dish.findUnique({
    where: { id: dishId },
    include: {
      ingredients: {
        include: {
          ingredient: true
        }
      }
    }
  });
};
const deleteDish = async (dishId: number): Promise<Dish> => {
  return prisma.dish.delete({
    where: { id: dishId }
  });
};
export default {
  createDish,
  updateDish,
  getDishes,
  getDishById,
  deleteDish
};
