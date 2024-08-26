import type { DailySummary } from "@/domain/entities/daily_summary";
import {
	User,
	type UserActivity,
	type UserMeal,
	type UserWeight,
	getUserBMR,
	userActivity_convexSchema,
	userMeal_convexSchema,
	userWeight_convexSchema,
	user_convexSchema,
} from "@/domain/entities/user";
import {
	type GetLastNDaysSummaryResult,
	getLastNDaysSummary,
} from "@/domain/usecases/get-summary";
import type { Id } from "convex/_generated/dataModel";
import { v } from "convex/values";
import { DateTime } from "luxon";
import {
	type QueryCtx,
	internalMutation,
	internalQuery,
} from "./_generated/server";

export const _getTelegramUser = internalQuery({
	args: {
		telegramUserId: v.number(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("user")
			.withIndex("by_telegram_user_id", (q) =>
				q.eq("telegram.userId", args.telegramUserId),
			)
			.first();
		return user;
	},
});

export const _getUser = internalQuery({
	args: {
		userId: v.id("user"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) throw new Error("User not found");
		return user;
	},
});

export const _createUser = internalMutation({
	args: user_convexSchema,
	handler: async (ctx, args) => {
		const userId = await ctx.db.insert("user", args);
		const user = await ctx.db.get(userId);
		if (!user) throw new Error("Failed to create user");
		return user;
	},
});

export const _recordUserWeight = internalMutation({
	args: userWeight_convexSchema,
	handler: async (ctx, args) => {
		await ctx.db.insert("userWeight", args);
		// Update the user's current weight
		await ctx.db.patch(args.userId, { weight: args.weight });
	},
});

export const _recordUserMealAndCalories = internalMutation({
	args: userMeal_convexSchema,
	handler: async (ctx, args) => {
		await ctx.db.insert("userMeal", args);
	},
});

export const _recordActivityAndBurn = internalMutation({
	args: userActivity_convexSchema,
	handler: async (ctx, args) => {
		await ctx.db.insert("userActivity", args);
	},
});

export const _setUserTimezone = internalMutation({
	args: {
		userId: v.id("user"),
		timezone: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.userId, { timezone: args.timezone });
	},
});

export const _setUserGender = internalMutation({
	args: {
		userId: v.id("user"),
		gender: v.union(v.literal("male"), v.literal("female")),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.userId, { gender: args.gender });
	},
});

export const _setUserAge = internalMutation({
	args: {
		userId: v.id("user"),
		age: v.number(),
	},
	handler: async (ctx, args) => {
		const currentYear = new Date().getFullYear();
		await ctx.db.patch(args.userId, { yearOfBirth: currentYear - args.age });
	},
});

export const _setUserHeight = internalMutation({
	args: {
		userId: v.id("user"),
		height: v.object({
			value: v.number(),
			units: v.literal("cm"),
		}),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.userId, { height: args.height });
	},
});

export const _getLastNDaysSummary = internalQuery({
	args: {
		userId: v.id("user"),
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
		userId: Id<"user">;
		fromTimestamp: number;
		toTimestamp: number;
	},
): Promise<DailySummary[]> {
	const { userId, fromTimestamp, toTimestamp, userTz } = params;
	const meals = await ctx.db
		.query("userMeal")
		.withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
		.filter((q) =>
			q.and(
				q.gte(q.field("timestamp"), fromTimestamp),
				q.lt(q.field("timestamp"), toTimestamp),
			),
		)
		.collect();

	const weights = await ctx.db
		.query("userWeight")
		.withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
		.filter((q) =>
			q.and(
				q.gte(q.field("timestamp"), fromTimestamp),
				q.lt(q.field("timestamp"), toTimestamp),
			),
		)
		.collect();

	const activities = await ctx.db
		.query("userActivity")
		.withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
		.filter((q) =>
			q.and(
				q.gte(q.field("timestamp"), fromTimestamp),
				q.lt(q.field("timestamp"), toTimestamp),
			),
		)
		.collect();

	const user = await ctx.db.get(userId);
	if (!user) throw new Error("User not found");

	const bmr = getUserBMR(user, { currentYear: new Date().getFullYear() }); //TODO: This estimate technically can be better since weight, year and height are mutable attributes

	const summaries: DailySummary[] = computeDailySummary({
		userTz,
		baseBurn: bmr.bmr,
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
	baseBurn: {
		value: number;
		units: "kcal";
	};
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

	// validate units
	if (params.baseBurn.units !== "kcal") {
		throw new Error("Base burn units must be in kcal");
	}

	const summaries: DailySummary[] = [];

	for (let i = 0; i < numDays; i++) {
		const dayStart = startTimestamp + i * oneDayInMs;
		const dayEnd = dayStart + oneDayInMs - 1;

		const dayMeals = meals.filter(
			(meal) => meal.timestamp >= dayStart && meal.timestamp < dayEnd,
		);
		const hasMealData = dayMeals.length > 0;
		const caloriesIn = dayMeals.reduce(
			(sum, meal) => sum + (meal.totalCalories.value || 0),
			0,
		);

		const dayActivities = activities.filter(
			(activity) =>
				activity.timestamp >= dayStart && activity.timestamp < dayEnd,
		);
		const hasActivityData = dayActivities.length > 0;
		const activityBurn = dayActivities.reduce(
			(sum, activity) => sum + (activity.caloriesBurned.value || 0),
			0,
		);

		const baseBurn = params.baseBurn;
		const caloriesOut = baseBurn.value + activityBurn;
		console.log({
			caloriesOut,
			baseBurn,
			activityBurn,
		});

		const deficit = caloriesOut - caloriesIn;

		const dayWeights = weights.filter(
			(w) => w.timestamp >= dayStart && w.timestamp < dayEnd,
		);
		const hasWeightData = dayWeights.length > 0;
		const avgWeight = dayWeights.reduce(
			(avg, w) => {
				avg.total += w.weight.value;
				avg.count++;
				return avg;
			},
			{ total: 0, count: 0 },
		);

		const weight =
			avgWeight.count > 0 ? avgWeight.total / avgWeight.count : undefined;

		const summary: DailySummary = {
			hasData: hasMealData || hasActivityData || hasWeightData,
			date: DateTime.fromMillis(dayStart)
				.setZone(userTz)
				.toFormat("yyyy-MM-dd"),
			dateTs: dayStart,
		};
		if (caloriesIn) {
			summary.caloriesIn = {
				value: caloriesIn,
				units: "kcal",
			};
		}
		if (caloriesOut) {
			summary.caloriesOut = {
				value: caloriesOut,
				units: "kcal",
			};
		}
		if (deficit) {
			summary.deficit = {
				value: deficit,
				units: "kcal",
			};
		}
		if (weight) {
			summary.weight = {
				value: weight,
				units: "kg",
			};
		}
		summaries.push(summary);
	}
	return summaries;
}
