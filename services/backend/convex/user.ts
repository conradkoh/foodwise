import {
  user_convexSchema,
  userActivity_convexSchema,
  userMeal_convexSchema,
  userWeight_convexSchema,
} from '@/domain/entities/user';
import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const _getTelegramUser = internalQuery({
  args: {
    telegramUserId: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_telegram_user_id', (q) =>
        q.eq('telegram.userId', args.telegramUserId)
      )
      .first();
    return user;
  },
});

export const _createUser = internalMutation({
  args: user_convexSchema,
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert('user', args);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('Failed to create user');
    return user;
  },
});

export const _recordUserWeight = internalMutation({
  args: userWeight_convexSchema,
  handler: async (ctx, args) => {
    await ctx.db.insert('userWeight', args);
  },
});

export const _recordUserMealAndCalories = internalMutation({
  args: userMeal_convexSchema,
  handler: async (ctx, args) => {
    await ctx.db.insert('userMeal', args);
  },
});

export const _recordActivityAndBurn = internalMutation({
  args: userActivity_convexSchema,
  handler: async (ctx, args) => {
    await ctx.db.insert('userActivity', args);
  },
});

export const _setUserTimezone = internalMutation({
  args: {
    userId: v.id('user'),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { timezone: args.timezone });
  },
});
