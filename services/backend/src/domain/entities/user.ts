import { zid, zodToConvex } from '@/utils/convex';
import { z } from 'zod';
//========================================
//User
//========================================

export type User = z.infer<typeof user_zodSchema>;

// zod
const user_zodSchema = z.object({
  type: z.literal('telegram'),
  telegram: z.object({
    userId: z.number(),
    firstName: z.optional(z.string()),
    lastName: z.optional(z.string()),
    username: z.optional(z.string()),
  }),
});

// convex
export const user_convexSchema = zodToConvex(user_zodSchema);

//========================================
//User Weight
//========================================
export type UserWeight = z.infer<typeof userWeight_zodSchema>;

const userWeight_zodSchema = z.object({
  userId: zid('user'),
  weight: z.object({
    value: z.number(),
    units: z.literal('kg'),
  }),
  timestamp: z.number(),
});

export const userWeight_convexSchema = zodToConvex(userWeight_zodSchema);

//========================================
//User Meal
//========================================
export type UserMeal = z.infer<typeof userMeal_zodSchema>;

const userMeal_zodSchema = z.object({
  userId: zid('user'),
  meal: z.string(),
  calories: z.object({
    value: z.number(),
    units: z.literal('kcal'),
  }),
  timestamp: z.number(),
});

export const userMeal_convexSchema = zodToConvex(userMeal_zodSchema);

//========================================
//User Activity
//========================================
export type UserActivity = z.infer<typeof userActivity_zodSchema>;

const userActivity_zodSchema = z.object({
  userId: zid('user'),
  activity: z.string(),
  caloriesBurned: z.object({
    value: z.number(),
    units: z.literal('kcal'),
  }),
  timestamp: z.number(),
});

export const userActivity_convexSchema = zodToConvex(userActivity_zodSchema);
