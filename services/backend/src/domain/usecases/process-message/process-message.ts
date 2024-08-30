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
} from "@/domain/usecases/process-message/process-message.types";
import { SYSTEM_PROMPT } from "@/domain/usecases/process-message/prompts/system-prompt";
import { DateTime } from "luxon";
import { ProcessMessageResultBuilder } from "./ProcessMessageResultBuilder";
import { openAIFormat } from "@/utils/openai/format";

export const processMessage: ProcessMessageFunc =
	(deps) =>
	async (params): Promise<ProcessMessageResult> => {
		const resultBuilder = new ProcessMessageResultBuilder();
		const endOfCurrentDayTs = DateTime.now()
			.setZone(params.userTz)
			.endOf("day")
			.toMillis();

		try {
			// Handle /start command
			if (params.inputText.trim().toLowerCase() === "/start") {
				return handleStartCommand(deps, params, resultBuilder);
			}

			const stage1Result = await processStage1(deps, resultBuilder)(params);

			await handleStage1Actions(
				deps,
				params,
				stage1Result.stage1Output,
				resultBuilder,
				endOfCurrentDayTs,
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
			formatOpenAIUsage(stage1Usage, "Stage 1 Usage"),
		);

		return { stage1Output, stage1Usage };
	};

async function handleStage1Actions(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	stage1Output: Stage1Output,
	resultBuilder: ProcessMessageResultBuilder,
	endOfCurrentDayTs: number,
) {
	const actionHandlers = {
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
		stage1Output.actions.map(async (action) => {
			const intent = action.intent;
			const handler = actionHandlers[intent];
			if (handler) {
				await handler(
					deps,
					params,
					action as any,
					resultBuilder,
					endOfCurrentDayTs,
				);
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
			formatOpenAIUsage(stage2Usage, "Stage 2 Usage"),
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

// Action handlers
async function handleRecordWeight(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: WeightAction,
	resultBuilder: ProcessMessageResultBuilder,
	endOfCurrentDayTs: number,
) {
	await deps.recordUserWeight({
		userId: params.userId,
		weight: action.weight,
		timestamp: DateTime.now().toMillis(),
	});
	resultBuilder.addActionTaken(
		`Recorded weight: ${action.weight.value} ${action.weight.units}`,
	);

	// Fetch and display weight summary for the last 3 days
	const summary = await deps.getLastNDaysSummary({
		numDays: 3,
		userId: params.userId,
		endOfCurrentDayTs,
		userTz: params.userTz,
	});
	const weightSummary = formatWeightSummary(summary);
	if (weightSummary) {
		resultBuilder.addAdditionalMessage(weightSummary);
	}
}

async function handleRecordMealsAndCalories(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: MealAction,
	resultBuilder: ProcessMessageResultBuilder,
	endOfCurrentDayTs: number,
) {
	const totalCalories = action.items.reduce(
		(state: { kcal: number }, item) => {
			const average =
				(item.estimatedCalories.min + item.estimatedCalories.max) / 2;
			state.kcal += average;
			return state;
		},
		{ kcal: 0 },
	);
	const { intent: _, ...args } = action;
	await deps.recordUserMealAndCalories({
		...args,
		totalCalories: {
			value: Math.round(totalCalories.kcal),
			units: "kcal",
		},
		items: action.items.map((item) => ({
			...item,
			estimatedCalories: {
				value: Math.round(
					(item.estimatedCalories.min + item.estimatedCalories.max) / 2,
				),
				min: item.estimatedCalories.min,
				max: item.estimatedCalories.max,
				units: item.estimatedCalories.units,
			},
		})),
		userId: params.userId,
		timestamp: DateTime.now().toMillis(),
	});
	resultBuilder.addActionTaken(
		`Recorded meal with calories: (${Math.round(totalCalories.kcal)} kcal)`,
	);

	// Fetch and display progress update
	const update = await getProgressUpdate(deps, params, endOfCurrentDayTs);
	if (update) {
		resultBuilder.addAdditionalMessage(update);
	}
}

async function handleRecordActivitiesAndBurn(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: ActivityAction,
	resultBuilder: ProcessMessageResultBuilder,
	endOfCurrentDayTs: number,
) {
	const averageCaloriesBurned =
		(action.caloriesBurned.min + action.caloriesBurned.max) / 2;
	const { intent: _, ...args } = action;
	await deps.recordActivityAndBurn({
		...args,
		caloriesBurned: {
			value: Math.round(averageCaloriesBurned),
			min: action.caloriesBurned.min,
			max: action.caloriesBurned.max,
			units: "kcal",
		},
		userId: params.userId,
		timestamp: DateTime.now().toMillis(),
	});
	resultBuilder.addActionTaken(
		`Recorded activity: ${action.activity} (${Math.round(averageCaloriesBurned)} ${action.caloriesBurned.units} burned)`,
	);

	// Fetch and display progress update
	const update = await getProgressUpdate(deps, params, endOfCurrentDayTs);
	if (update) {
		resultBuilder.addAdditionalMessage(update);
	}
}

function handleGetGeneralAdvice(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: GeneralAdviceAction,
	resultBuilder: ProcessMessageResultBuilder,
) {
	resultBuilder.addActionTaken(`Received advice: ${action.advice}`);
}

function handleEstimateCalories(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: EstimateCaloriesAction,
	resultBuilder: ProcessMessageResultBuilder,
) {
	const totalCalories = action.items.reduce(
		(state: { kcal: number }, item) => {
			const average =
				(item.estimatedCalories.min + item.estimatedCalories.max) / 2;
			state.kcal += average;
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
}

async function handleSetTimezone(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: SetTimezoneAction,
	resultBuilder: ProcessMessageResultBuilder,
) {
	const { intent: _, ...args } = action;
	await deps.setUserTimezone({
		...args,
		userId: params.userId,
	});
	resultBuilder.addActionTaken(`Set timezone: ${action.timezone}`);
}

async function handleGetWeeklySummary(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: WeeklySummaryAction,
	resultBuilder: ProcessMessageResultBuilder,
	endOfCurrentDayTs: number,
) {
	const summary = await deps.getLastNDaysSummary({
		numDays: 7,
		userId: params.userId,
		endOfCurrentDayTs,
		userTz: params.userTz,
	});
	const summaryText = formatSummary({
		type: "weekly",
		summary,
		userTz: params.userTz,
	});
	resultBuilder.addActionTaken(summaryText);
}

async function handleGetDailySummary(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: DailySummaryAction,
	resultBuilder: ProcessMessageResultBuilder,
	endOfCurrentDayTs: number,
) {
	const last2DaySummary = await deps.getLastNDaysSummary({
		numDays: 2,
		userId: params.userId,
		endOfCurrentDayTs,
		userTz: params.userTz,
	});
	const summaryText = formatSummary({
		type: "daily",
		summary: last2DaySummary,
		userTz: params.userTz,
	});
	resultBuilder.addActionTaken(summaryText);
}

function handleEditPreviousAction(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: EditPreviousActionAction,
	resultBuilder: ProcessMessageResultBuilder,
) {
	resultBuilder.addActionTaken(
		"Editing previous actions is not currently supported. I apologize for the inconvenience.",
	);
}

async function handleSetUserGender(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: SetUserGenderAction,
	resultBuilder: ProcessMessageResultBuilder,
) {
	await deps.setUserGender({
		userId: params.userId,
		gender: action.gender,
	});
	resultBuilder.addActionTaken(`Set user gender: ${action.gender}`);
}

async function handleSetUserAge(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: SetUserAgeAction,
	resultBuilder: ProcessMessageResultBuilder,
) {
	await deps.setUserAge({
		userId: params.userId,
		age: action.age,
	});
	resultBuilder.addActionTaken(`Set user age: ${action.age}`);
}

async function handleSetUserHeight(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	action: SetUserHeightAction,
	resultBuilder: ProcessMessageResultBuilder,
) {
	await deps.setUserHeight({
		userId: params.userId,
		height: action.height,
	});
	resultBuilder.addActionTaken(
		`Set user height: ${action.height.value} ${action.height.units}`,
	);
}

function formatOpenAIUsage(
	usage: Awaited<ReturnType<typeof openAIParse>>["usage"],
	title: string,
): MessageUsageMetric {
	return {
		type: "openai",
		title,
		openAI: {
			tokens: {
				prompt: usage.tokens.prompt,
				completion: usage.tokens.completion,
				total: usage.tokens.total,
			},
			cost: {
				currency: "USD",
				total: usage.cost.total,
				input: usage.cost.input,
				output: usage.cost.output,
			},
		},
	};
}

async function getProgressUpdate(
	deps: ProcessMessageDeps,
	params: ProcessMessageParams,
	endOfCurrentDayTs: number,
): Promise<string | undefined> {
	const dailySummary = await deps.getLastNDaysSummary({
		numDays: 1,
		userId: params.userId,
		endOfCurrentDayTs,
		userTz: params.userTz,
	});

	const summary = dailySummary.dailySummaries[0];
	if (summary) {
		return PROGRESS_UPDATE_TEXT({
			date: summary.date,
			caloriesIn: summary.caloriesIn?.value || 0,
			caloriesOut: summary.caloriesOut?.value || 0,
		});
	}
	return undefined;
}

function formatSummary(params: {
	type: "weekly" | "daily";
	summary: GetLastNDaysSummaryResult;
	userTz: string;
}) {
	const resultLines = [`${params.type} summary:\n\n`];

	for (const dailySummary of params.summary.dailySummaries) {
		resultLines.push(`Date: ${dailySummary.date}`);
		if (!dailySummary.hasData) {
			resultLines.push("  No data recorded.");
			continue;
		}

		if (dailySummary.caloriesIn) {
			resultLines.push(
				`  Calories In: ${dailySummary.caloriesIn.value} ${dailySummary.caloriesIn.units}`,
			);
		}
		if (dailySummary.caloriesOut) {
			resultLines.push(
				`  Calories Out: ${dailySummary.caloriesOut.value} ${dailySummary.caloriesOut.units}`,
			);
		}
		if (dailySummary.deficit) {
			resultLines.push(
				`  Deficit: ${dailySummary.deficit.value} ${dailySummary.deficit.units}`,
			);
		}
		if (dailySummary.weight) {
			resultLines.push(
				`  Weight: ${dailySummary.weight.value} ${dailySummary.weight.units}`,
			);
		}
		if (dailySummary.firstWeight) {
			resultLines.push(
				`  First Weight: ${dailySummary.firstWeight.value} ${dailySummary.firstWeight.units}`,
			);
		}
		if (dailySummary.lastWeight) {
			resultLines.push(
				`  Last Weight: ${dailySummary.lastWeight.value} ${dailySummary.lastWeight.units}`,
			);
		}
	}

	// Summary across all days
	resultLines.push(`Summary Across All Days:`);
	if (params.summary.overview?.weightLost) {
		resultLines.push(
			`  Weight Lost: ${params.summary.overview.weightLost.value} ${params.summary.overview.weightLost.units}`,
		);
	} else {
		resultLines.push("  Weight Lost: No data recorded");
	}
	if (params.summary.overview?.averageCalorieDeficit) {
		resultLines.push(
			`  Average Daily Calorie Deficit: ${params.summary.overview.averageCalorieDeficit.value.toFixed(2)} ${params.summary.overview.averageCalorieDeficit.units}`,
		);
	}
	return resultLines.join("\n");
}

function formatWeightSummary(
	summary: GetLastNDaysSummaryResult,
): string | undefined {
	const weightLogs = summary.dailySummaries.map((d) => {
		const dayOfWeekStr = DateTime.fromISO(d.date).toFormat("ccc");
		if (!d.lastWeight?.value) {
			return {
				date: d.date,
				lastWeight: d.lastWeight,
				description: `[${dayOfWeekStr}] Weight: No data recorded`,
			};
		}
		return {
			date: d.date,
			lastWeight: d.weight,
			description: `[${dayOfWeekStr}] Weight: ${d.lastWeight.value} ${d.lastWeight.units}`,
		};
	});

	if (weightLogs.length === 0) {
		return undefined;
	}

	const formattedLogs = weightLogs
		.map((log) => `   - ${log.description}`)
		.join("\n");

	return `EOD Weight summary for the last 3 days:\n${formattedLogs}`;
}
