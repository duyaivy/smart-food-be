import { IRecommendationOutput } from '../models/interfaces/recommendation.interface';

/**
 * Fallback recommendation output used when the external AI provider is
 * unavailable or mock mode is enabled (config.recommendation.useMockData).
 * This is the contract clients rely on when the real provider fails.
 */
export const RECOMMENDATION_OUTPUT_TEMPLATE: IRecommendationOutput = {
  status: 'FAILED',
  plan: [
    {
      day: 1,
      date: '2026-04-21T00:00:00.000Z',
      meals: {
        breakfast: [],
        lunch: [],
        dinner: []
      },
      nutrition: { calories: 1980, protein: 110, carb: 230, fat: 55 }
    },
    {
      day: 2,
      date: '2026-04-22T00:00:00.000Z',
      meals: {
        breakfast: [
          { dishId: 6, role: 'MAIN_DISH', missingIngredient: [] },
          {
            dishId: 3,
            role: 'VEGETABLE',
            missingIngredient: [{ ingredientId: 21, unit: 'GAM', quantity: 120 }]
          }
        ],
        lunch: [
          { dishId: 9, role: 'MAIN_DISH', missingIngredient: [] },
          {
            dishId: 3,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 22, unit: 'NUMBER', quantity: 2 }]
          },
          { dishId: 6, role: 'VEGETABLE', missingIngredient: [] }
        ],
        dinner: [
          {
            dishId: 7,
            role: 'MAIN_DISH',
            missingIngredient: [{ ingredientId: 30, unit: 'GAM', quantity: 180 }]
          },
          { dishId: 11, role: 'SOUP', missingIngredient: [] },
          { dishId: 7, role: 'VEGETABLE', missingIngredient: [] }
        ]
      },
      nutrition: { calories: 2050, protein: 115, carb: 240, fat: 58 }
    },
    {
      day: 3,
      date: '2026-04-23T00:00:00.000Z',
      meals: {
        breakfast: [
          { dishId: 6, role: 'MAIN_DISH', missingIngredient: [] },
          { dishId: 3, role: 'VEGETABLE', missingIngredient: [] }
        ],
        lunch: [
          {
            dishId: 9,
            role: 'MAIN_DISH',
            missingIngredient: [{ ingredientId: 31, unit: 'GAM', quantity: 250 }]
          },
          { dishId: 3, role: 'SOUP', missingIngredient: [] },
          { dishId: 6, role: 'VEGETABLE', missingIngredient: [] }
        ],
        dinner: [
          { dishId: 7, role: 'MAIN_DISH', missingIngredient: [] },
          {
            dishId: 11,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 32, unit: 'NUMBER', quantity: 1 }]
          },
          {
            dishId: 7,
            role: 'VEGETABLE',
            missingIngredient: [{ ingredientId: 33, unit: 'GAM', quantity: 80 }]
          }
        ]
      },
      nutrition: { calories: 2100, protein: 120, carb: 245, fat: 60 }
    }
  ],
  summary: {
    avgDailyCalories: 2043.33,
    targetCalories: 14350,
    deviation: -0.32,
    avgDailyProtein: 115,
    avgDailyCarbs: 238.33,
    avgDailyFat: 57.67
  },
  shoppingList: [
    { ingredientId: 7, quantity: 200, unit: 'GAM' },
    { ingredientId: 11, quantity: 150, unit: 'GAM' },
    { ingredientId: 15, quantity: 1, unit: 'NUMBER' },
    { ingredientId: 18, quantity: 100, unit: 'GAM' },
    { ingredientId: 21, quantity: 120, unit: 'GAM' },
    { ingredientId: 22, quantity: 2, unit: 'NUMBER' },
    { ingredientId: 30, quantity: 180, unit: 'GAM' },
    { ingredientId: 31, quantity: 250, unit: 'GAM' },
    { ingredientId: 32, quantity: 1, unit: 'NUMBER' },
    { ingredientId: 33, quantity: 80, unit: 'GAM' }
  ],
  message: 'Kết nối đến hệ thống không ổn định, vui lòng thử lại sau.'
};
