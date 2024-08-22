import { telegramPayloadConvexSchema } from '@/utils/telegram';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
export default defineSchema({
  messages: defineTable({
    rawPayload: telegramPayloadConvexSchema,
  }),
  user: defineTable(
    v.object({
      type: v.literal('telegram'),
      telegram: v.object({
        userId: v.number(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        username: v.optional(v.string()),
      }),
    })
  ).index('by_telegram_user_id', ['telegram.userId']),
  userWeight: defineTable({
    userId: v.id('user'),
    weight: v.object({
      value: v.number(),
      units: v.literal('kg'),
    }),
    timestamp: v.number(),
  }),
  userMeal: defineTable({
    userId: v.id('user'),
    meal: v.string(),
    calories: v.object({
      value: v.number(),
      units: v.literal('kcal'),
    }),
    timestamp: v.number(),
  }),
  userActivity: defineTable({
    userId: v.id('user'),
    activity: v.string(),
    caloriesBurned: v.object({
      value: v.number(),
      units: v.literal('kcal'),
    }),
    timestamp: v.number(),
  }),
});
