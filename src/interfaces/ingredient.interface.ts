export interface IIngredient {
  id: number;
  name: string;
  categoryId?: number;
  desciption?: string;
  protein?: number;
  unit: string;
  carbs?: number;
  fat?: number;
  createdAt: Date;
  updatedAt: Date;
}
