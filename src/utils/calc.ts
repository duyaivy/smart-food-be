export const calcCalories = (
  protein?: number | null,
  carb?: number | null,
  fat?: number | null,
  weight?: number | null
) => {
  if (
    protein === null ||
    protein === undefined ||
    carb === null ||
    carb === undefined ||
    fat === null ||
    fat === undefined ||
    weight === null ||
    weight === undefined
  ) {
    return 0;
  }
  return Math.round((protein * 4 + carb * 4 + fat * 9) * (weight / 100));
};
