import {
  user_convexSchema,
  userActivity_convexSchema,
  userMeal_convexSchema,
  userWeight_convexSchema,
} from '@/domain/entities/user';
import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { start } from 'repl';
import { has } from 'effect/Record';

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

export const _getWeeklySummary = internalQuery({
  args: {
    userId: v.id('user'),
    currentTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, currentTimestamp } = args;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const sevenDaysAgoTimestamp = currentTimestamp - 7 * oneDayInMs;

    const meals = await ctx.db
      .query('userMeal')
      .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
      .filter((q) => q.gte(q.field('timestamp'), sevenDaysAgoTimestamp))
      .collect();

    const weights = await ctx.db
      .query('userWeight')
      .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
      .filter((q) => q.gte(q.field('timestamp'), sevenDaysAgoTimestamp))
      .collect();

    const activities = await ctx.db
      .query('userActivity')
      .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
      .filter((q) => q.gte(q.field('timestamp'), sevenDaysAgoTimestamp))
      .collect();

    const dailySummaries = [];

    // start iterating from today backwards
    let curRange = {
      end: currentTimestamp,
      start: currentTimestamp - 7 * oneDayInMs,
    };
    for (let i = 0; i < 7; i++) {
      const dayMeals = meals.filter(
        (meal) =>
          meal.timestamp >= curRange.start && meal.timestamp <= curRange.end
      );
      const caloriesIn = dayMeals.reduce(
        (sum, meal) => {
          if (meal.totalCalories.value) {
            if (sum === undefined) {
              return meal.totalCalories.value;
            }
            return sum + meal.totalCalories.value;
          }
        },
        undefined as number | undefined
      );

      const dayActivities = activities.filter(
        (activity) =>
          activity.timestamp >= curRange.start &&
          activity.timestamp <= curRange.end
      );
      const activityBurn = dayActivities.reduce(
        (sum, activity) => {
          if (activity.caloriesBurned.value) {
            if (sum === undefined) {
              return activity.caloriesBurned.value;
            }
            return sum + activity.caloriesBurned.value;
          }
        },
        undefined as number | undefined
      );

      // Assuming a base metabolic rate of 2000 kcal
      const baseBurn = 1600;
      const caloriesOut =
        activityBurn !== undefined ? baseBurn + activityBurn : undefined; //undefined means no data

      const deficit =
        caloriesOut !== undefined && caloriesIn !== undefined
          ? caloriesOut - caloriesIn
          : undefined;

      const dayWeights = weights
        .filter(
          (w) => w.timestamp >= curRange.start && w.timestamp <= curRange.end
        )
        .reduce(
          (avg, w) => {
            switch (w.weight.units) {
              case 'kg': {
                avg.numDataPoints++;
                avg.total['kg'] += w.weight.value;
                break;
              }
              default: {
                // exhaustive switch
                const _: never = w.weight.units;
              }
            }
            return avg;
          },
          {
            numDataPoints: 0,
            total: {
              'kg': 0,
            },
          }
        );

      dailySummaries.push({
        range: curRange,
        caloriesIn,
        caloriesOut,
        deficit,
        weight: dayWeights.total['kg'] / dayWeights.numDataPoints, //get average
        hasData: !!(
          caloriesIn !== undefined ||
          caloriesOut !== undefined ||
          dayWeights.total['kg'] > 0 ||
          dayWeights.numDataPoints
        ),
      });

      // update the range
      curRange = {
        start: curRange.start - oneDayInMs,
        end: curRange.end - oneDayInMs,
      };
    }

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
