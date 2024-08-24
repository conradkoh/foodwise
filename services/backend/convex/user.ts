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

// interface DailySummary {
//   range: {
//     start: number;
//     end: number;
//   };
//   caloriesIn?: number;
//   caloriesOut?: number;
//   deficit?: number;
//   weight?: number;
//   hasData: boolean;
// }

async function getSummariesRollupDaily(
  ctx: QueryCtx,
  params: {
    userId: Id<'user'>;
    startTimestamp: number;
    endTimestamp: number;
    userTz: string;
  }
): Promise<DailySummary[]> {
  const { userId, startTimestamp, endTimestamp, userTz } = params;
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

  const summaries: DailySummary[] = computeDailySummary({
    userTz,
    baseBurn: 1600, //TODO: get from user
    endTimestamp,
    startTimestamp,
    meals,
    activities,
    weights,
  });

  return summaries;
}

export const _getLastNDaysSummary = internalQuery({
  args: {
    userId: v.id('user'),
    endOfCurrentDayTs: v.number(),
    numDays: v.number(),
    userTz: v.string(),
  },
  handler: async (ctx, args): Promise<GetLastNDaysSummaryResult> => {
    const { userId, endOfCurrentDayTs, userTz } = args;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const rangeStartTs = endOfCurrentDayTs - args.numDays * oneDayInMs;

    const dailySummaries = await getSummariesRollupDaily(ctx, {
      userTz,
      userId,
      startTimestamp: rangeStartTs,
      endTimestamp: endOfCurrentDayTs,
    });

    const summary = await getLastNDaysSummary({
      getSummariesRollupDaily: () => Promise.resolve(dailySummaries),
    })({
      userId,
      endOfCurrentDayTs,
    });

    return summary;
  },
});

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
    const baseBurn = params.baseBurn;
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

    const summary: DailySummary = {
      hasData: false,
      range: {
        start: {
          ts: dayStart,
          str: DateTime.fromMillis(dayStart)
            .setZone(userTz)
            .toFormat('dd MMM yyyy HH:mm'),
        },

        end: {
          ts: dayEnd,
          str: DateTime.fromMillis(dayEnd)
            .setZone(userTz)
            .toFormat('dd MMM yyyy HH:mm'),
        },
      },
    };
    if (caloriesIn) {
      summary.hasData = true;
      summary.caloriesIn = {
        value: caloriesIn,
        units: 'kcal',
      };
    }
    if (caloriesOut) {
      summary.hasData = true;
      summary.caloriesOut = {
        value: caloriesOut,
        units: 'kcal',
      };
    }
    if (deficit) {
      summary.hasData = true;
      summary.deficit = {
        value: deficit,
        units: 'kcal',
      };
    }
    if (weight) {
      summary.hasData = true;
      summary.weight = {
        value: weight,
        units: 'kg',
      };
    }
    summaries.push(summary);
  }
  return summaries;
}
