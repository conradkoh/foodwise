import type { MessageUsageMetric } from "@/domain/entities/message";
import { INTENTS } from "@/domain/usecases/process-message/intent";
import {
	type ActivityAction,
	type DailySummaryAction,
	type EditPreviousActionAction,
	type EstimateCaloriesAction,
	type GeneralAdviceAction,
	type MealAction,
	type SetTimezoneAction,
	type SetUserAgeAction,
	type SetUserGenderAction,
	type SetUserHeightAction,
	type Stage1Output,
	type WeeklySummaryAction,
	type WeightAction,
	stage1Output_zodSchema,
} from "@/domain/usecases/process-message/schemas/stage_1";
import { openAIParse } from "@/utils/openai";

import { isUserReady } from "@/domain/entities/user";
import type { GetLastNDaysSummaryResult } from "@/domain/usecases/get-summary";
import { ALL_SET_MESSAGE } from "@/domain/usecases/process-message/messages/all-set";
import { PROGRESS_UPDATE_TEXT } from "@/domain/usecases/process-message/messages/progress-update";
import type {
	ProcessMessageDeps,
	ProcessMessageFunc,
	ProcessMessageParams,
	ProcessMessageResult,
	ProcessMessageStage1Handler,
} from "@/domain/usecases/process-message/process-message.types";
import { SYSTEM_PROMPT } from "@/domain/usecases/process-message/prompts/system-prompt";
import { DateTime } from "luxon";
import { ProcessMessageResultBuilder } from "./ProcessMessageResultBuilder";
import { openAIFormat } from "@/utils/openai/format";
import { formatDeficitSurplus } from "@/domain/usecases/process-message/messages/fragments/deficit";
import type { BRAND } from "zod";
import {
	endOfCurrentDay,
	endOfDay,
} from "@/domain/usecases/process-message/process-message.utils";
import {
	formatWeight,
	formatWeightDifference,
	WEIGHT_SUMMARY_TEXT,
} from "@/domain/usecases/process-message/messages/fragments/weight-summary";
import { DAY_OF_WEEK_FORMAT } from "@/domain/usecases/process-message/messages/format/date";
import type { DailySummary } from "@/domain/entities/daily_summary";
import { formatUsage } from "@/infra/metrics/usage";

export const processMessage: ProcessMessageFunc =
	(deps) =>
	async (params): Promise<ProcessMessageResult> => {
		const resultBuilder = new ProcessMessageResultBuilder();
		try {
			// Handle /start command
			if (params.inputText.trim().toLowerCase() === "/start") {
				return handleStartCommand(deps, params, resultBuilder);
			}

			const stage1Result = await processStage1(deps, resultBuilder)(params);
			await handleStage1Actions(
				deps,
				params,
				stage1Result.stage1Output.actions,
				resultBuilder,
			);

			const stage2Result = await processStage2(deps, resultBuilder)(params);
			resultBuilder.setMessage(stage2Result.stage2Output.response);

			return resultBuilder.build();
		} catch (error) {
			console.error("failed to process message.", error);
			return handleError(resultBuilder);
		}
	};

async function handleStartCommand(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	resultBuilder: ProcessMessageResultBuilder,
): Promise<ProcessMessageResult> {
	const userDetails = await deps.getUserLatestState({
		userId: params.userId,
	});
	const isUserAccountReady = isUserReady(userDetails);
	let response = `Welcome! To get started, please set your timezone. You can say something like "set my timezone to Singapore".

I also need some information to calculate your Basal Metabolic Rate (BMR). Please provide the following details:

1. Your gender (male or female)
2. Your age in years
3. Your height in centimeters
4. Your weight in kilograms

You can respond with something like: "I'm a 30-year-old male, 175 cm tall."`;

	if (isUserAccountReady) {
		response = ALL_SET_MESSAGE;
	}

	return resultBuilder
		.setMessage(response)
		.setStage1Output({ actions: [] })
		.setStage2Output({ response })
		.addActionTaken("Handled /start command")
		.build();
}

const processStage1 =
	(deps: ProcessMessageDeps, resultBuilder: ProcessMessageResultBuilder) =>
	async (params: ProcessMessageParams) => {
		const {
			response: { data: stage1Output },
			usage: stage1Usage,
		} = await openAIParse({
			systemPrompt: SYSTEM_PROMPT({
				currentDateStr: params.currentDateStr,
				stage: "STAGE_1",
			}),
			text: params.inputText,
			schema: {
				name: "user_health_information_stage_1",
				zod: stage1Output_zodSchema,
			},
		});
		resultBuilder.setStage1Output(stage1Output);
		resultBuilder.addUsageMetric(
			formatUsage({
				type: "openai",
				data: stage1Usage,
				title: "Stage 1 Usage",
			}),
		);

		return { stage1Output, stage1Usage };
	};

async function handleStage1Actions(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	actions: Stage1Output["actions"],
	resultBuilder: ProcessMessageResultBuilder,
) {
	const actionHandlers: Record<string, ProcessMessageStage1Handler<any>> = {
		[INTENTS.RECORD_WEIGHT]: handleRecordWeight,
		[INTENTS.RECORD_MEALS_AND_CALORIES]: handleRecordMealsAndCalories,
		[INTENTS.RECORD_ACTIVITIES_AND_BURN]: handleRecordActivitiesAndBurn,
		[INTENTS.GET_GENERAL_ADVICE]: handleGetGeneralAdvice,
		[INTENTS.ESTIMATE_CALORIES]: handleEstimateCalories,
		[INTENTS.SET_TIMEZONE]: handleSetTimezone,
		[INTENTS.GET_WEEKLY_SUMMARY]: handleGetWeeklySummary,
		[INTENTS.GET_DAILY_SUMMARY]: handleGetDailySummary,
		[INTENTS.EDIT_PREVIOUS_ACTION]: handleEditPreviousAction,
		[INTENTS.SET_USER_GENDER]: handleSetUserGender,
		[INTENTS.SET_USER_AGE]: handleSetUserAge,
		[INTENTS.SET_USER_HEIGHT]: handleSetUserHeight,
	} as const;

	await Promise.all(
		actions.map(async (action) => {
			const intent = action.intent;
			const handler = actionHandlers[intent];
			if (handler) {
				await handler({ deps, params, action, resultBuilder });
			}
		}),
	);

	// onboarding: check if after the actions were taken, the user is ready to use the app
	const nextUserState = await deps.getUserLatestState({
		userId: params.userId,
	});
	const nextIsUserReady = isUserReady(nextUserState);
	if (
		!isUserReady(await deps.getUserLatestState({ userId: params.userId })) &&
		nextIsUserReady
	) {
		resultBuilder.addActionTaken("Account is ready to use the app!");
		resultBuilder.addActionTaken(
			`Prepared message for the user: ${ALL_SET_MESSAGE}`,
		);
	}
}

const processStage2 =
	(deps: ProcessMessageDeps, resultBuilder: ProcessMessageResultBuilder) =>
	async (params: ProcessMessageParams) => {
		const { response, usage: stage2Usage } = await openAIFormat({
			systemPrompt: SYSTEM_PROMPT({
				currentDateStr: params.currentDateStr,
				stage: "STAGE_2",
			}),
			text: JSON.stringify({
				userInput: params.inputText,
				actionsTaken: resultBuilder.build().actionsTaken,
			}),
			type: "fast",
			temperature: 20,
		});

		const stage2Output = { response: response.data };

		resultBuilder.setStage2Output(stage2Output);
		resultBuilder.addUsageMetric(
			formatUsage({
				type: "openai",
				data: stage2Usage,
				title: "Stage 2 Usage",
			}),
		);

		return { stage2Output, stage2Usage };
	};

function handleError(
	resultBuilder: ProcessMessageResultBuilder,
): ProcessMessageResult {
	return resultBuilder
		.setIsError(true)
		.setMessage(
			"I couldn't process your request. Please try rephrasing your message.",
		)
		.build();
}

const handleRecordWeight: ProcessMessageStage1Handler<WeightAction> = async ({
	deps,
	params,
	action,
	resultBuilder,
}) => {
	const { forDate } = await inferDate(deps, params, resultBuilder);
	const timestamp = localDateToTimestamp(forDate, params.userTz);
	await deps.recordUserWeight({
		userId: params.userId,
		weight: action.weight,
		timestamp,
	});
	resultBuilder.addActionTaken(
		`Recorded weight: ${action.weight.value} ${action.weight.units}`,
	);

	// Fetch and display weight summary for the last 3 days
	const summary = await deps.getLastNDaysSummary({
		numDays: 3,
		userId: params.userId,
		endOfLastDayTs: endOfDay(timestamp, params.userTz),
		userTz: params.userTz,
	});
	const weightSummary = formatWeightSummary(summary);
	if (weightSummary) {
		resultBuilder.addAdditionalMessage(weightSummary);
	}
};

const handleRecordMealsAndCalories: ProcessMessageStage1Handler<
	MealAction
> = async ({ deps, params, action, resultBuilder }) => {
	const totalCalories = action.items.reduce(
		(state: { kcal: number }, item) => {
			const average =
				((item.estimatedCaloriesPerPortion.min +
					item.estimatedCaloriesPerPortion.max) *
					item.numPortions) /
				2;
			state.kcal += average;
			return state;
		},
		{ kcal: 0 },
	);
	const { forDate } = await inferDate(deps, params, resultBuilder);
	const timestamp = localDateToTimestamp(forDate, params.userTz);
	await deps.recordUserMealAndCalories({
		schemaVersion: "v2",
		totalCalories: {
			value: Math.round(totalCalories.kcal),
			units: "kcal",
		},
		items: action.items.map((item) => ({
			...item,
		})),
		userId: params.userId,
		timestamp,
	});

	resultBuilder.addActionTaken(
		`Estimated calories by items:
\`\`\`
${JSON.stringify(action.items, null, 2)}
\`\`\`
`.trim(),
	);
	resultBuilder.addActionTaken(
		`Recorded meal with calories: (${Math.round(totalCalories.kcal)} kcal)`,
	);

	// Fetch and display progress update
	const update = await getProgressUpdate(
		deps,
		params,
		endOfDay(timestamp, params.userTz),
	);
	if (update) {
		resultBuilder.addAdditionalMessage(update);
	}
};

const handleRecordActivitiesAndBurn: ProcessMessageStage1Handler<
	ActivityAction
> = async ({ deps, params, action, resultBuilder }) => {
	const averageCaloriesBurned =
		(action.caloriesBurned.min + action.caloriesBurned.max) / 2;

	const { forDate } = await inferDate(deps, params, resultBuilder);
	const timestamp = localDateToTimestamp(forDate, params.userTz);
	await deps.recordActivityAndBurn({
		activity: action.activity,
		caloriesBurned: {
			value: Math.round(averageCaloriesBurned),
			min: action.caloriesBurned.min,
			max: action.caloriesBurned.max,
			units: "kcal",
		},
		userId: params.userId,
		timestamp,
	});
	resultBuilder.addActionTaken(
		`Recorded activity: ${action.activity} (${Math.round(averageCaloriesBurned)} ${action.caloriesBurned.units} burned)`,
	);

	// Fetch and display progress update
	const update = await getProgressUpdate(
		deps,
		params,
		endOfDay(timestamp, params.userTz),
	);
	if (update) {
		resultBuilder.addAdditionalMessage(update);
	}
};

const handleGetGeneralAdvice: ProcessMessageStage1Handler<
	GeneralAdviceAction
> = async ({ deps, params, action, resultBuilder }) => {
	resultBuilder.addActionTaken(`Received advice: ${action.advice}`);
};

const handleEstimateCalories: ProcessMessageStage1Handler<
	EstimateCaloriesAction
> = async ({ deps, params, action, resultBuilder }) => {
	const totalCalories = action.items.reduce(
		(state: { kcal: number }, item) => {
			const averageEach =
				(item.estimatedCalories.min + item.estimatedCalories.max) / 2;
			state.kcal += averageEach * item.quantity;
			return state;
		},
		{ kcal: 0 },
	);
	resultBuilder.addActionTaken(
		[
			`Estimated calories: ${Math.round(totalCalories.kcal)} kcal`,
			...action.items.map(
				(item) =>
					`  - ${item.name}: ${item.estimatedCalories.min}-${item.estimatedCalories.max} ${item.estimatedCalories.units}`,
			),
		].join("\n"),
	);
};

const handleSetTimezone: ProcessMessageStage1Handler<
	SetTimezoneAction
> = async ({ deps, params, action, resultBuilder }) => {
	await deps.setUserTimezone({
		timezone: action.timezone,
		userId: params.userId,
	});
	resultBuilder.addActionTaken(`Set timezone: ${action.timezone}`);
};

const handleGetWeeklySummary: ProcessMessageStage1Handler<
	WeeklySummaryAction
> = async ({ deps, params, action, resultBuilder }) => {
	const summary = await deps.getLastNDaysSummary({
		numDays: 7,
		userId: params.userId,
		endOfLastDayTs: endOfCurrentDay(params.userTz),
		userTz: params.userTz,
	});
	const summaryText = formatSummary({
		type: "weekly",
		summary,
		userTz: params.userTz,
	});

	resultBuilder.addActionTaken("Retrieved weekly summary");
	resultBuilder.addAdditionalMessage(summaryText);
};

const handleGetDailySummary: ProcessMessageStage1Handler<
	DailySummaryAction
> = async ({ deps, params, action, resultBuilder }) => {
	const last2DaySummary = await deps.getLastNDaysSummary({
		numDays: 2,
		userId: params.userId,
		endOfLastDayTs: endOfCurrentDay(params.userTz),
		userTz: params.userTz,
	});
	const summaryText = formatSummary({
		type: "daily",
		summary: last2DaySummary,
		userTz: params.userTz,
	});
	resultBuilder.addActionTaken(
		"Retrieved daily summary. Comparing with yesterday.",
	);
	resultBuilder.addAdditionalMessage(summaryText);
};

const handleEditPreviousAction: ProcessMessageStage1Handler<
	EditPreviousActionAction
> = async ({ deps, params, action, resultBuilder }) => {
	resultBuilder.addActionTaken(
		"Editing previous actions is not currently supported. I apologize for the inconvenience.",
	);
};

const handleSetUserGender: ProcessMessageStage1Handler<
	SetUserGenderAction
> = async ({ deps, params, action, resultBuilder }) => {
	await deps.setUserGender({
		userId: params.userId,
		gender: action.gender,
	});
	resultBuilder.addActionTaken(`Set user gender: ${action.gender}`);
};

const handleSetUserAge: ProcessMessageStage1Handler<SetUserAgeAction> = async ({
	deps,
	params,
	action,
	resultBuilder,
}) => {
	await deps.setUserAge({
		userId: params.userId,
		age: action.age,
	});
	resultBuilder.addActionTaken(`Set user age: ${action.age}`);
};

const handleSetUserHeight: ProcessMessageStage1Handler<
	SetUserHeightAction
> = async ({ deps, params, action, resultBuilder }) => {
	await deps.setUserHeight({
		userId: params.userId,
		height: action.height,
	});
	resultBuilder.addActionTaken(
		`Set user height: ${action.height.value} ${action.height.units}`,
	);
};
/**
 * Gets the progress update for the given date
 * @param deps
 * @param params
 * @param forDateTs
 * @returns
 */
async function getProgressUpdate(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	forDateTs: number,
): Promise<string | undefined> {
	const dailySummary = await deps.getLastNDaysSummary({
		numDays: 1,
		userId: params.userId,
		endOfLastDayTs: forDateTs,
		userTz: params.userTz,
	});

	const summary = dailySummary.dailySummaries[0];
	if (summary) {
		return PROGRESS_UPDATE_TEXT({
			date: summary.date,
			dayOfWeek: summary.dayOfWeek,
			caloriesIn: summary.caloriesIn,
			caloriesOut: summary.caloriesOut,
		});
	}
	return undefined;
}

/**
 * Infers date and adds usage metric
 * @param deps
 * @param params
 * @param resultBuilder
 * @returns
 */
const inferDate = async (
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	resultBuilder: ProcessMessageResultBuilder,
) => {
	const { forDate, _usage } = await deps.inferDate({
		currentDateStr: params.currentDateStr,
		message: params.inputText,
	});
	resultBuilder.addUsageMetric(_usage);
	return {
		forDate,
	};
};

function formatSummary(params: {
	type: "weekly" | "daily";
	summary: GetLastNDaysSummaryResult;
	userTz: string;
}) {
	const resultLines = [];

	// for (const dailySummary of params.summary.dailySummaries) {
	for (let i = 0; i < params.summary.dailySummaries.length; i++) {
		const daySummary = params.summary.dailySummaries[i] as DailySummary;
		// derived
		const previousDaySummary = params.summary.dailySummaries[i - 1];
		if (resultLines.length > 0) {
			resultLines.push(""); // add a blank line between the summary for each day
		}
		resultLines.push(`<b>📆 [${daySummary.dayOfWeek}] ${daySummary.date}</b>`);
		if (!daySummary.hasData) {
			resultLines.push("  No data");
			continue;
		}
		resultLines.push(
			"  [Calories] " +
				formatDeficitSurplus({
					mode: "by_calories",
					caloriesIn: daySummary.caloriesIn,
					caloriesOut: daySummary.caloriesOut,
				}),
		);

		// weight
		// first record has no comparison
		if (i === 0) {
			const firstWeight = [
				daySummary.firstMorningWeight,
				daySummary.lastEveningWeight,
			].filter(Boolean)[0];
			if (firstWeight) {
				resultLines.push(`  [Weight] Initial @ ${formatWeight(firstWeight)}`);
			} else {
				resultLines.push("  [Weight] No data");
			}
		}
		// best: morning to morning
		else if (
			previousDaySummary?.firstMorningWeight &&
			daySummary.firstMorningWeight
		) {
			resultLines.push(
				"  [Weight M2M] " +
					formatWeightDifference({
						earlier: previousDaySummary?.firstMorningWeight,
						later: daySummary.firstMorningWeight,
						text: {
							earlier: "prev morning",
							later: "morning",
						},
					}),
			);
		}
		// next best: evening to evening
		else if (
			previousDaySummary?.lastEveningWeight &&
			daySummary.lastEveningWeight
		) {
			resultLines.push(
				"  [Weight E2E] " +
					formatWeightDifference({
						earlier: previousDaySummary?.lastEveningWeight,
						later: daySummary.lastEveningWeight,
						text: {
							earlier: "prev evening",
							later: "evening",
						},
					}),
			);
		}
		// last: morning to evening
		else {
			resultLines.push(
				"  [Weight M2E] " +
					formatWeightDifference({
						earlier: daySummary?.firstMorningWeight,
						later: daySummary.lastEveningWeight,
						text: {
							earlier: "morning",
							later: "evening",
						},
					}),
			);
		}
	}

	const message = `
${resultLines.join("\n")}

🗒️ Summary Across All Days:
  [Calories (Avg)] ${formatDeficitSurplus({ mode: "by_deficit", deficit: params.summary.overview?.averageCalorieDeficit })}
  [Weight] ${formatWeightDifference({
		earlier: params.summary.overview?.earliestWeight,
		later: params.summary.overview?.latestWeight,
		text: {
			earlier: "earliest",
			later: "latest",
		},
	})}
`.trim();

	return message;
}

function formatWeightSummary(
	summary: GetLastNDaysSummaryResult,
): string | undefined {
	const weightLogs = summary.dailySummaries.map((d) => {
		const dayOfWeekStr = DAY_OF_WEEK_FORMAT(DateTime.fromISO(d.date));
		return {
			date: d.date,
			lastWeight: d.weight,
			description: `${WEIGHT_SUMMARY_TEXT({
				dayOfWeekStr,
				firstMorningWeight: d.firstMorningWeight,
				lastEveningWeight: d.lastEveningWeight,
			})}`,
		};
	});

	if (weightLogs.length === 0) {
		return undefined;
	}

	const formattedLogs = weightLogs
		.map((log) => `   - ${log.description}`)
		.join("\n");

	return `Weight summary for the last ${summary.dailySummaries.length} days:\n${formattedLogs}`;
}

function localDateToTimestamp(
	date: string & BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss">,
	tz: string,
) {
	const dateTime = DateTime.fromFormat(date, "yyyy-MM-dd HH:mm:ss", {
		zone: tz,
	});
	return dateTime.toMillis();
}
