import {
  DailySummary,
  dailySummary_zodSchema,
} from '@/domain/entities/daily_summary';
import { zid } from 'convex-helpers/server/zod';
import { Id } from 'convex/_generated/dataModel';
import { z } from 'zod';

// zod input
export type GetLastNDaysSummaryParams = z.infer<
  typeof getLastNDaysSummary_params_zodSchema
>;
const getLastNDaysSummary_params_zodSchema = z.object({
  userId: zid('user'),
  endOfCurrentDayTs: z.number(),
});

// zod output
export type GetLastNDaysSummaryResult = z.infer<
  typeof getLastNDaysSummary_output_zodSchema
>;
const getLastNDaysSummary_output_zodSchema = z.union([
  // daily summaries found
  z.object({
    hasData: z.literal(true),
    dailySummaries: z.array(dailySummary_zodSchema),
    overview: z.object({
      weightLost: z.optional(
        z.object({
          value: z.number(),
          units: z.literal('kg'),
        })
      ),
      averageCalorieDeficit: z.optional(
        z.object({
          value: z.number(),
          units: z.literal('kcal'),
        })
      ),
    }),
  }),
  z.object({
    //no data found in summaries
    hasData: z.literal(false),
    dailySummaries: z.array(dailySummary_zodSchema),
    overview: z.undefined(),
  }),
]);

type Deps = {
  getSummariesRollupDaily: (params: {
    userId: Id<'user'>;
    fromTimestamp: number;
    toTimestamp: number;
  }) => Promise<DailySummary[]>;
};

/**
 * Get the last N days summary of the user's activity
 * @param deps
 * @returns
 */
export const getLastNDaysSummary =
  (deps: Deps) =>
  async (
    params: GetLastNDaysSummaryParams
  ): Promise<GetLastNDaysSummaryResult> => {
    const { userId, endOfCurrentDayTs } = params;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const sevenDaysAgoTimestamp = endOfCurrentDayTs - 7 * oneDayInMs;

    const dailySummaries = await deps.getSummariesRollupDaily({
      userId,
      fromTimestamp: sevenDaysAgoTimestamp,
      toTimestamp: endOfCurrentDayTs,
    });

    if (dailySummaries.length === 0) {
      return {
        hasData: false,
        dailySummaries: [],
        overview: undefined,
      };
    }

    // calculate the summary
    const overview: GetLastNDaysSummaryResult['overview'] =
      getOverviewFromDailySummaries(dailySummaries);

    return {
      hasData: true,
      dailySummaries,
      overview,
    } satisfies GetLastNDaysSummaryResult;
  };
/**
 * Compute the overview from the daily summaries
 * @param dailySummaries
 * @returns
 */
function getOverviewFromDailySummaries(dailySummaries: DailySummary[]) {
  // 1. weight loss
  const firstDay = dailySummaries[0];
  const lastDay = dailySummaries[dailySummaries.length - 1];

  // 2. average calorie deficit
  let averageCalorieDeficit = {
    total: 0,
    numDaysWithData: 0,
  };
  for (let dailySummary of dailySummaries) {
    if (dailySummary.deficit) {
      averageCalorieDeficit.total += dailySummary.deficit.value;
      averageCalorieDeficit.numDaysWithData++;
    }
  }

  const overview: GetLastNDaysSummaryResult['overview'] = {};
  if (lastDay.weight && firstDay.weight) {
    if (lastDay.weight.units !== firstDay.weight.units) {
      throw new Error('Weight units do not match');
    }
    const weightUnit = lastDay.weight.units;
    const weightLost = {
      value: lastDay.weight.value - firstDay.weight.value,
      units: weightUnit,
    };
    overview.weightLost = {
      value: weightLost.value,
      units: weightLost.units,
    };
  }
  if (lastDay.deficit && firstDay.deficit) {
    if (lastDay.deficit.units !== firstDay.deficit.units) {
      throw new Error('Deficit units do not match');
    }
    const deficitUnit = lastDay.deficit.units;
    const deficit = {
      value:
        averageCalorieDeficit.total / averageCalorieDeficit.numDaysWithData,
      units: deficitUnit,
    };
    overview.averageCalorieDeficit = deficit;
  }
  return overview;
}
