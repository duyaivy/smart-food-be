import { ActivityLevel, User } from '@prisma/client';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.ACTIVE]: 1.725,
  [ActivityLevel.VERY_ACTIVE]: 1.9
};

const DEFAULT_WEIGHT_KG = 60;
const DEFAULT_HEIGHT_CM = 165;
const DEFAULT_BIRTHDAY = new Date('1990-01-01T00:00:00.000Z');
const DEFAULT_SEX = true;
const DEFAULT_ACTIVITY_LEVEL = ActivityLevel.SEDENTARY;

export const calculateMaintenanceTdee = (
  user: Pick<User, 'height' | 'weight' | 'birthday' | 'sex' | 'activityLevel'>
): number => {
  const weight = user.weight ?? DEFAULT_WEIGHT_KG;
  const height = user.height ?? DEFAULT_HEIGHT_CM;
  const birthday = user.birthday ?? DEFAULT_BIRTHDAY;
  const sex = user.sex ?? DEFAULT_SEX;
  const activityLevel = user.activityLevel ?? DEFAULT_ACTIVITY_LEVEL;

  const ageDays = (Date.now() - birthday.getTime()) / (1000 * 60 * 60 * 24);
  const age = Math.floor(ageDays / 365.25);

  const bmr = sex
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? ACTIVITY_MULTIPLIERS.SEDENTARY;

  return Math.round(bmr * multiplier);
};

export const calculateDefaultMacroTargetFromTdee = (tdee: number) => ({
  calories: tdee,
  protein: Math.round((tdee * 0.2) / 4),
  carb: Math.round((tdee * 0.5) / 4),
  fat: Math.round((tdee * 0.3) / 9)
});
