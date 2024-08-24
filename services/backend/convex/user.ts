import {
  user_convexSchema,
  userActivity_convexSchema,
  userMeal_convexSchema,
  userWeight_convexSchema,
} from '@/domain/entities/user';
import { internalMutation, internalQuery, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { start } from 'repl';
import { has } from 'effect/Record';
import { Id } from 'convex/_generated/dataModel';

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

interface DailySummary {
  range: {
    start: number;
    end: number;
  };
  caloriesIn?: number;
  caloriesOut?: number;
  deficit?: number;
  weight?: number;
  hasData: boolean;
}

async function getSummariesRollupDaily(
  ctx: QueryCtx,
  userId: Id<'user'>,
  startTimestamp: number,
  endTimestamp: number
): Promise<DailySummary[]> {
  const meals = await ctx.db
    .query('userMeal')
    .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
    .filter((q) =>
      q.and(
        q.gte(q.field('timestamp'), startTimestamp),
        q.lt(q.field('timestamp'), endTimestamp)
      )
    )
    .collect();

  const weights = await ctx.db
    .query('userWeight')
    .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
    .filter((q) =>
      q.and(
        q.gte(q.field('timestamp'), startTimestamp),
        q.lt(q.field('timestamp'), endTimestamp)
      )
    )
    .collect();

  const activities = await ctx.db
    .query('userActivity')
    .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
    .filter((q) =>
      q.and(
        q.gte(q.field('timestamp'), startTimestamp),
        q.lt(q.field('timestamp'), endTimestamp)
      )
    )
    .collect();

  const oneDayInMs = 24 * 60 * 60 * 1000;
  const numDays = Math.ceil((endTimestamp - startTimestamp) / oneDayInMs);

  const summaries: DailySummary[] = [];

  for (let i = 0; i < numDays; i++) {
    const dayStart = startTimestamp + i * oneDayInMs;
    const dayEnd = dayStart + oneDayInMs;

    const dayMeals = meals.filter(
      (meal) => meal.timestamp >= dayStart && meal.timestamp < dayEnd
    );
    const caloriesIn = dayMeals.reduce(
      (sum, meal) => sum + (meal.totalCalories.value || 0),
      0
    );

    const dayActivities = activities.filter(
      (activity) =>
        activity.timestamp >= dayStart && activity.timestamp < dayEnd
    );
    const activityBurn = dayActivities.reduce(
      (sum, activity) => sum + (activity.caloriesBurned.value || 0),
      0
    );

    // Assuming a base metabolic rate of 1600 kcal
    const baseBurn = 1600;
    const caloriesOut = baseBurn + activityBurn;

    const deficit = caloriesOut - caloriesIn;

    const dayWeights = weights.filter(
      (w) => w.timestamp >= dayStart && w.timestamp < dayEnd
    );
    const avgWeight = dayWeights.reduce(
      (avg, w) => {
        avg.total += w.weight.value;
        avg.count++;
        return avg;
      },
      { total: 0, count: 0 }
    );

    const weight =
      avgWeight.count > 0 ? avgWeight.total / avgWeight.count : undefined;

    summaries.push({
      range: { start: dayStart, end: dayEnd },
      caloriesIn: caloriesIn || undefined,
      caloriesOut: caloriesOut || undefined,
      deficit: deficit || undefined,
      weight,
      hasData: !!(caloriesIn || activityBurn || weight),
    });
  }

  return summaries;
}

export const _getWeeklySummary = internalQuery({
  args: {
    userId: v.id('user'),
    currentTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, currentTimestamp } = args;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const sevenDaysAgoTimestamp = currentTimestamp - 7 * oneDayInMs;

    const dailySummaries = await getSummariesRollupDaily(
      ctx,
      userId,
      sevenDaysAgoTimestamp,
      currentTimestamp
    );

    const delta = {
      start: dailySummaries[0],
      end: dailySummaries[dailySummaries.length - 1],
    };
    let weightChange: number | undefined = undefined;
    if (delta.end.weight && delta.start.weight) {
      weightChange = delta.end.weight - delta.start.weight;
    }

    // calculate average deficit
    const summary = dailySummaries.reduce(
      (state, day) => {
        if (day.deficit) {
          state.total += day.deficit;
          state.numDaysWithData++;
        }
        return state;
      },
      {
        total: 0,
        numDaysWithData: 0,
      }
    );

    return {
      dailySummaries,
      weightChange,
      averageCalorieDeficit: summary.total / summary.numDaysWithData,
    };
  },
});

export const _getLast2DaySummary = internalQuery({
  args: {
    userId: v.id('user'),
    endOfDayTimestamp: v.number(), // Timestamp for the start of the day
  },
  handler: async (ctx, args) => {
    const { userId, endOfDayTimestamp } = args;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const startOfDayTimestamp = endOfDayTimestamp - oneDayInMs * 2;

    const summaries = await getSummariesRollupDaily(
      ctx,
      userId,
      startOfDayTimestamp,
      endOfDayTimestamp
    );
    return {
      yesterday: summaries[0],
      today: summaries[1],
    };
  },
});
