import { FridgeTransactionType, Prisma } from '@prisma/client';
import prisma from '../client';

const buildFridgeTransactionNote = (type: FridgeTransactionType, name: string): string => {
  const transactionNoteFactory: Record<FridgeTransactionType, (value: string) => string> = {
    [FridgeTransactionType.ADD]: (ingredientName) => `Đã thêm "${ingredientName}" vào tủ lạnh`,
    [FridgeTransactionType.ADJUST]: (ingredientName) =>
      `Đã cập nhật "${ingredientName}" trong tủ lạnh`,
    [FridgeTransactionType.DISCARD]: (ingredientName) => `Đã xóa "${ingredientName}" khỏi tủ lạnh`,
    [FridgeTransactionType.EXPIRE]: (ingredientName) =>
      `Nguyên liệu "${ingredientName}" trong tủ lạnh đã hết hạn`,
    [FridgeTransactionType.COOK]: (mealName) => `Đã ghi nhận bữa ăn "${mealName}"`
  };

  return transactionNoteFactory[type](name);
};

const createFridgeTransaction = async (
  fridgeId: number,
  type: FridgeTransactionType,
  name: string,
  tx?: Prisma.TransactionClient
) => {
  const client = tx ?? prisma;

  return client.fridgeTransaction.create({
    data: {
      fridgeId,
      type,
      note: buildFridgeTransactionNote(type, name)
    }
  });
};

export default {
  buildFridgeTransactionNote,
  createFridgeTransaction
};
