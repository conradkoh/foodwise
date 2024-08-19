import { v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';
import {
  registerWebhookAction,
  sendMessageAction,
  telegramPayloadConvexSchema,
} from '@/utils/telegram';

export const registerWebhook = registerWebhookAction;
export const sendMessage = sendMessageAction;

//_writeMessage writes a message to the database
export const _writeMessage = internalMutation({
  args: {
    rawPayload: telegramPayloadConvexSchema,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      rawPayload: args.rawPayload,
    });
  },
});
