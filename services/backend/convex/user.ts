import {
  user_convexSchema,
  UserActivity,
  userActivity_convexSchema,
  UserMeal,
  userMeal_convexSchema,
  UserWeight,
  userWeight_convexSchema,
} from '@/domain/entities/user';
import { internalMutation, internalQuery, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { Id } from 'convex/_generated/dataModel';
import {
  getLastNDaysSummary,
  GetLastNDaysSummaryResult,
} from '@/domain/usecases/get-summary';
import { DailySummary } from '@/domain/entities/daily_summary';
import { DateTime } from 'luxon';

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

export const _getLastNDaysSummary = internalQuery({
  args: {
    userId: v.id('user'),
    endOfCurrentDayTs: v.number(),
    numDays: v.number(),
    userTz: v.string(),
  },
  handler: async (ctx, args): Promise<GetLastNDaysSummaryResult> => {
    const { userId, endOfCurrentDayTs, userTz, numDays } = args;
    const summary = await getLastNDaysSummary({
      getSummariesRollupDaily: (params) => {
        return getSummariesRollupDaily(ctx, params);
      },
    })({
      userTz,
      userId,
      numDays,
      endOfCurrentDayTs,
    });

    return summary;
  },
});
/**
 * Create summaries rolled up daily
 * @param ctx
 * @param params
 * @returns
 */
async function getSummariesRollupDaily(
  ctx: QueryCtx,
  params: {
    userTz: string;
    userId: Id<'user'>;
    fromTimestamp: number;
    toTimestamp: number;
  }
): Promise<DailySummary[]> {
  const { userId, fromTimestamp, toTimestamp, userTz } = params;
  const meals = await ctx.db
    .query('userMeal')
    .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
    .filter((q) =>
      q.and(
        q.gte(q.field('timestamp'), fromTimestamp),
        q.lt(q.field('timestamp'), toTimestamp)
      )
    )
    .collect();

  const weights = await ctx.db
    .query('userWeight')
    .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
    .filter((q) =>
      q.and(
        q.gte(q.field('timestamp'), fromTimestamp),
        q.lt(q.field('timestamp'), toTimestamp)
      )
    )
    .collect();

  const activities = await ctx.db
    .query('userActivity')
    .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
    .filter((q) =>
      q.and(
        q.gte(q.field('timestamp'), fromTimestamp),
        q.lt(q.field('timestamp'), toTimestamp)
      )
    )
    .collect();

  const summaries: DailySummary[] = computeDailySummary({
    userTz,
    baseBurn: 1600, //TODO: get from user
    endTimestamp: toTimestamp,
    startTimestamp: fromTimestamp,
    meals,
    activities,
    weights,
  });

  return summaries;
}

/**
 * Given the user's consumption, compute the daily summary
 * @param params
 * @returns
 */
function computeDailySummary(params: {
  userTz: string;
  baseBurn: number;
  endTimestamp: number;
  startTimestamp: number;
  meals: UserMeal[];
  activities: UserActivity[];
  weights: UserWeight[];
}) {
  const { userTz, endTimestamp, startTimestamp, meals, activities, weights } =
    params;
  const oneDayInMs = 24 * 60 * 60 * 1000;
  const numDays = Math.ceil((endTimestamp - startTimestamp) / oneDayInMs);

  const summaries: DailySummary[] = [];

  for (let i = 0; i < numDays; i++) {
    const dayStart = startTimestamp + i * oneDayInMs;
    const dayEnd = dayStart + oneDayInMs - 1;

    const dayMeals = meals.filter(
      (meal) => meal.timestamp >= dayStart && meal.timestamp < dayEnd
    );
    const hasMealData = dayMeals.length > 0;
    const caloriesIn = dayMeals.reduce(
      (sum, meal) => sum + (meal.totalCalories.value || 0),
      0
    );

    const dayActivities = activities.filter(
      (activity) =>
        activity.timestamp >= dayStart && activity.timestamp < dayEnd
    );
    const hasActivityData = dayActivities.length > 0;
    const activityBurn = dayActivities.reduce(
      (sum, activity) => sum + (activity.caloriesBurned.value || 0),
      0
    );

    // Assuming a base metabolic rate of 1600 kcal
    const baseBurn = params.baseBurn;
    const caloriesOut = baseBurn + activityBurn;

    const deficit = caloriesOut - caloriesIn;

    const dayWeights = weights.filter(
      (w) => w.timestamp >= dayStart && w.timestamp < dayEnd
    );
    const hasWeightData = dayWeights.length > 0;
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

    const summary: DailySummary = {
      hasData: hasMealData || hasActivityData || hasWeightData,
      date: DateTime.fromMillis(dayStart)
        .setZone(userTz)
        .toFormat('yyyy-MM-dd'),
      dateTs: dayStart,
    };
    if (caloriesIn) {
      summary.caloriesIn = {
        value: caloriesIn,
        units: 'kcal',
      };
    }
    if (caloriesOut) {
      summary.caloriesOut = {
        value: caloriesOut,
        units: 'kcal',
      };
    }
    if (deficit) {
      summary.deficit = {
        value: deficit,
        units: 'kcal',
      };
    }
    if (weight) {
      summary.weight = {
        value: weight,
        units: 'kg',
      };
    }
    summaries.push(summary);
  }
  return summaries;
}
