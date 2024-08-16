import { z } from 'zod';
import { zodToConvex } from '@/utils/convex';
//Types
export type WebhookPayload = z.infer<typeof telegramPayloadZodSchema>;
export function parseTelegramPayload(payload: any): WebhookPayload {
  return telegramPayloadZodSchema.parse(payload);
}

//Zod
const telegramPayloadZodSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      from: z.object({
        id: z.number(),
        is_bot: z.boolean(),
        first_name: z.string(),
        last_name: z.string().optional(), // Optional
        username: z.string().optional(), // Optional
        language_code: z.string().optional(), // Optional
      }),
      chat: z.object({
        id: z.number(),
        first_name: z.string().optional(), // Optional
        last_name: z.string().optional(), // Optional
        username: z.string().optional(), // Optional
        type: z.string(),
      }),
      date: z.number(),
      text: z.string().optional(), // Optional
      entities: z
        .array(
          z.object({
            offset: z.number(),
            length: z.number(),
            type: z.string(),
          })
        )
        .optional(), // Optional
    })
    .optional(), // Optional because other types of updates can exist
});

//Convex
export const telegramPayloadConvexSchema = zodToConvex(
  telegramPayloadZodSchema
);
