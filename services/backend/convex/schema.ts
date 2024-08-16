import { telegramPayloadConvexSchema } from '@/utils/telegram';
import { defineSchema, defineTable } from 'convex/server';
export default defineSchema({
  messages: defineTable({
    rawPayload: telegramPayloadConvexSchema,
  }),
});
