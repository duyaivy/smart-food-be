import prisma from '../../client';

const createPushToken = async (
  userId: number,
  token: string,
  deviceName: string
): Promise<void> => {
  await prisma.pushToken.create({
    data: {
      userId,
      token,
      deviceName
    }
  });
};

export default {
  createPushToken
};
