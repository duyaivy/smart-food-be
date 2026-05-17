export type IngredientNutritionSource = {
  protein: number | null;
  carb: number | null;
  fat: number | null;
};

export type NutritionSnapshotInput = {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
};

export const roundNutrition = (value: number): number => Number(value.toFixed(2));

export const calculateIngredientNutrition = (
  ingredient: IngredientNutritionSource | null,
  gramsEquivalent: number
) => {
  const ratio = gramsEquivalent / 100;

  const protein = roundNutrition((ingredient?.protein ?? 0) * ratio);
  const carb = roundNutrition((ingredient?.carb ?? 0) * ratio);
  const fat = roundNutrition((ingredient?.fat ?? 0) * ratio);
  const kcal = roundNutrition(protein * 4 + carb * 4 + fat * 9);

  return {
    kcal,
    protein,
    carb,
    fat
  };
};

export const calculateTotalNutrition = <T extends NutritionSnapshotInput>(snapshots: T[]) => {
  const totalKcal = roundNutrition(snapshots.reduce((total, snapshot) => total + snapshot.kcal, 0));
  const totalProtein = roundNutrition(
    snapshots.reduce((total, snapshot) => total + snapshot.protein, 0)
  );
  const totalCarb = roundNutrition(snapshots.reduce((total, snapshot) => total + snapshot.carb, 0));
  const totalFat = roundNutrition(snapshots.reduce((total, snapshot) => total + snapshot.fat, 0));

  return {
    totalKcal,
    totalProtein,
    totalCarb,
    totalFat
  };
};

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
