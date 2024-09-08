import {
	type DailySummary,
	dailySummary_zodSchema,
} from "@/domain/entities/daily_summary";
import { zid } from "convex-helpers/server/zod";
import type { Id } from "convex/_generated/dataModel";
import { z } from "zod";

// zod input
export type GetLastNDaysSummaryParams = z.infer<
	typeof getLastNDaysSummary_params_zodSchema
>;
const getLastNDaysSummary_params_zodSchema = z.object({
	userTz: z.string(),
	userId: zid("user"),
	endOfLastDayTs: z.number(),
	numDays: z.number(),
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
			earliestWeight: z.optional(
				z.object({
					value: z.number(),
					units: z.literal("kg"),
				}),
			),
			latestWeight: z.optional(
				z.object({
					value: z.number(),
					units: z.literal("kg"),
				}),
			),
			averageCalorieDeficit: z.optional(
				z.object({
					value: z.number(),
					units: z.literal("kcal"),
				}),
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
		userTz: string;
		userId: Id<"user">;
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
		params: GetLastNDaysSummaryParams,
	): Promise<GetLastNDaysSummaryResult> => {
		const { userId, endOfLastDayTs, userTz, numDays } = params;
		const oneDayInMs = 24 * 60 * 60 * 1000;
		const nDaysAgoStartTimestamp = endOfLastDayTs - numDays * oneDayInMs + 1;

		const dailySummaries = await deps.getSummariesRollupDaily({
			userTz,
			userId,
			fromTimestamp: nDaysAgoStartTimestamp,
			toTimestamp: endOfLastDayTs,
		});

		if (dailySummaries.length === 0) {
			return {
				hasData: false,
				dailySummaries: [],
				overview: undefined,
			};
		}

		// calculate the summary
		const overview: GetLastNDaysSummaryResult["overview"] =
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
	const summariesWithData = dailySummaries.filter((d) => d.hasData);
	// 1. weight loss
	const firstDay = summariesWithData[0];
	const lastDay = summariesWithData[summariesWithData.length - 1];
	if (lastDay.dateTs < firstDay.dateTs) {
		const msg = `getOverviewFromDailySummaries failed: lastDay.dateTs < firstDay.dateTs. lastDay.dateTs: ${lastDay.dateTs}, firstDay.dateTs: ${firstDay.dateTs}`;
		throw new Error(msg);
	}

	// 2. average calorie deficit
	const calorieStats = {
		total: 0,
		numDaysWithData: 0,
	};
	const seenCalorieUnit = "kcal" as const; //hard coded for now
	for (const dailySummary of summariesWithData) {
		if (
			dailySummary.deficit &&
			dailySummary.deficit.units !== seenCalorieUnit
		) {
			throw new Error(
				"getOverviewFromDailySummaries failed: deficit units do not match",
			);
		}
		if (dailySummary.deficit) {
			calorieStats.total += dailySummary.deficit.value;
			calorieStats.numDaysWithData++;
		}
	}

	const overview: GetLastNDaysSummaryResult["overview"] = {};

	// order all measurements - first of day and last of day
	const allWeightsOrdered = dailySummaries.reduce(
		(state, day) => {
			if (day.firstMorningWeight) {
				state.push(day.firstMorningWeight);
			}
			if (day.lastEveningWeight) {
				state.push(day.lastEveningWeight);
			}
			return state;
		},
		[] as { value: number; units: "kg" }[],
	);

	// set the overview earliest weight
	overview.earliestWeight =
		allWeightsOrdered.length > 0 ? allWeightsOrdered[0] : undefined;

	// set the overview latest weight
	overview.latestWeight =
		allWeightsOrdered.length > 0
			? allWeightsOrdered[allWeightsOrdered.length - 1]
			: undefined;

	// set the overview average calorie deficit
	overview.averageCalorieDeficit = {
		value: calorieStats.total / calorieStats.numDaysWithData,
		units: seenCalorieUnit,
	};
	return overview;
}
