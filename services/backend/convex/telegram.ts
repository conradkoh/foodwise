import { v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';

// registerWebhook registers the webhook with telegram.
// run this from the convex console to register the webhook
export const registerWebhook = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const url = `${process.env.CONVEX_SITE_URL}/onMessage`;
    const response = await fetch(
      'https://api.telegram.org/bot' +
        process.env.TELEGRAM_BOT_TOKEN +
        '/setWebhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
        }),
      }
    );
    if (response.status !== 200) {
      throw new Error('Failed to register webhook');
    }
  },
});

//_writeMessage writes a message to the database
export const _writeMessage = internalMutation({
  args: {
    rawPayload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      rawPayload: args.rawPayload,
    });
  },
});
