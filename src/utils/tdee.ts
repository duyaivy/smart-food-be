import httpStatus from 'http-status';
import { ActivityLevel, User } from '@prisma/client';
import ApiError from './apiError';
import { roundNutrition } from './calc';
import { NutritionMacro } from '../models/interfaces/nutrition.interface';

const ACTIVITY_LEVEL_FACTOR: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.ACTIVE]: 1.725,
  [ActivityLevel.VERY_ACTIVE]: 1.9
};

const getAge = (birthday: Date) => {
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();

  const hasNotHadBirthdayThisYear =
    today.getMonth() < birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate());

  if (hasNotHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
};

export const calculateMaintenanceTdee = (
  user: Pick<User, 'height' | 'weight' | 'birthday' | 'sex' | 'activityLevel'>
) => {
  if (!user.height || !user.weight || !user.birthday) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Vui lòng cập nhật chiều cao, cân nặng và ngày sinh để tính TDEE'
    );
  }

  const age = getAge(user.birthday);

  if (age <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Ngày sinh không hợp lệ để tính TDEE');
  }

  const baseBmr = 10 * user.weight + 6.25 * user.height - 5 * age;
  const bmr = user.sex ? baseBmr + 5 : baseBmr - 161;
  const activityFactor = ACTIVITY_LEVEL_FACTOR[user.activityLevel];

  return roundNutrition(bmr * activityFactor);
};

export const calculateDefaultMacroTargetFromTdee = (tdee: number): NutritionMacro => ({
  calories: roundNutrition(tdee),
  protein: roundNutrition((tdee * 0.2) / 4),
  carb: roundNutrition((tdee * 0.5) / 4),
  fat: roundNutrition((tdee * 0.3) / 9)
});
