import { message_convexSchema } from '@/domain/entities/message';
import {
  user_convexSchema,
  userActivity_convexSchema,
  userMeal_convexSchema,
  userWeight_convexSchema,
} from '@/domain/entities/user';
import { defineSchema, defineTable } from 'convex/server';
export default defineSchema({
  messages: defineTable(message_convexSchema),
  user: defineTable(user_convexSchema).index('by_telegram_user_id', [
    'telegram.userId',
  ]),
  userWeight: defineTable(userWeight_convexSchema),
  userMeal: defineTable(userMeal_convexSchema),
  userActivity: defineTable(userActivity_convexSchema),
});
