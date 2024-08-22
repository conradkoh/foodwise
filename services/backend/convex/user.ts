import { internalMutation, internalQuery } from 'convex/_generated/server';
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
  args: {
    telegramUserId: v.number(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert('user', {
      type: 'telegram',
      telegram: {
        userId: args.telegramUserId,
        firstName: args.firstName,
        lastName: args.lastName,
        username: args.username,
      },
    });
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('Failed to create user');
    return user;
  },
});

export const _recordUserWeight = internalMutation({
  args: {
    userId: v.id('user'),
    weight: v.object({
      value: v.number(),
      units: v.literal('kg'),
    }),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('userWeight', {
      userId: args.userId,
      weight: args.weight,
      timestamp: args.timestamp,
    });
  },
});

export const _recordUserMealAndCalories = internalMutation({
  args: {
    userId: v.id('user'),
    meal: v.string(),
    calories: v.object({
      value: v.number(),
      units: v.literal('kcal'),
    }),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('userMeal', {
      userId: args.userId,
      meal: args.meal,
      calories: args.calories,
      timestamp: args.timestamp,
    });
  },
});

export const _recordActivityAndBurn = internalMutation({
  args: {
    userId: v.id('user'),
    activity: v.string(),
    caloriesBurned: v.object({
      value: v.number(),
      units: v.literal('kcal'),
    }),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('userActivity', {
      userId: args.userId,
      activity: args.activity,
      caloriesBurned: args.caloriesBurned,
      timestamp: args.timestamp,
    });
  },
});
