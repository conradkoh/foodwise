import { internalMutation } from 'convex/_generated/server';

export const migrate = internalMutation({
  args: {},
  handler: async (ctx) => {
    //  add the user id to the messages table
    const messages = await ctx.db.query('messages').collect();
    for (const message of messages) {
      const tgUserId = message.rawPayload.message.from.id;
      const userId = await ctx.db
        .query('user')
        .withIndex('by_telegram_user_id', (q) =>
          q.eq('telegram.userId', tgUserId)
        )
        .first();
      if (tgUserId && userId) {
        await ctx.db.patch(message._id, {
          userId: userId._id,
        });
      }
    }
  },
});
