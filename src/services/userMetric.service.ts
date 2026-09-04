import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/apiError';
import { calculateDefaultMacroTargetFromTdee, calculateMaintenanceTdee } from '../utils/tdee';

const getDefaultDailyMacroTarget = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      height: true,
      weight: true,
      birthday: true,
      sex: true,
      activityLevel: true
    }
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Người dùng không tồn tại');
  }

  const tdee = calculateMaintenanceTdee(user);
  return calculateDefaultMacroTargetFromTdee(tdee);
};

export default {
  getDefaultDailyMacroTarget
};
