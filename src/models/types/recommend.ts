import { Unit } from '@prisma/client';

export type FridgeItemMinimal = {
  ingredientId: number;
  quantity: number;
  unit: Unit;
  dueDate: Date;
};
