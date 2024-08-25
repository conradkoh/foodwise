import { MessageUsageMetric } from '@/domain/entities/message';
import { INTENTS } from '@/domain/usecases/process-message/intent';
import {
  Stage1Output,
  stage1Output_zodSchema,
} from '@/domain/usecases/process-message/schemas/stage_1';
import {
  Stage2Output,
  stage2Output_zodSchema,
} from '@/domain/usecases/process-message/schemas/stage_2';
import { openAIParse } from '@/utils/openai';
import { z } from 'zod';

import { GetLastNDaysSummaryResult } from '@/domain/usecases/get-summary';
import { BoundMutation, BoundQuery } from '@/utils/convex';
import { internal } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { DateTime } from 'luxon';
import { ALL_SET_MESSAGE } from '@/domain/usecases/process-message/messages/all-set';
import { isUserReady } from '@/domain/entities/user';

export const processMessage =
  (deps: {
    recordUserWeight: BoundMutation<typeof internal.user._recordUserWeight>;
    recordUserMealAndCalories: BoundMutation<
      typeof internal.user._recordUserMealAndCalories
    >;
    recordActivityAndBurn: BoundMutation<
      typeof internal.user._recordActivityAndBurn
    >;
    getUserTimezone: () => Promise<string | undefined>;
    setUserTimezone: BoundMutation<typeof internal.user._setUserTimezone>;
    getLastNDaysSummary: BoundQuery<typeof internal.user._getLastNDaysSummary>;
    setUserGender: BoundMutation<typeof internal.user._setUserGender>;
    setUserAge: BoundMutation<typeof internal.user._setUserAge>;
    setUserHeight: BoundMutation<typeof internal.user._setUserHeight>;
    getUserLatestState: BoundQuery<typeof internal.user._getUser>;
  }) =>
  async (params: {
    userId: Id<'user'>;
    inputText: string;
    userTz: string;
    currentDateStr: string;
  }): Promise<
    | {
        isError: false;
        intermediates: {
          stage1Output: Stage1Output;
          stage2Output: Stage2Output;
        };
        actionsTaken: string[];
        usageMetrics: MessageUsageMetric[];
      }
    | {
        isError: true;
        intermediates: {
          stage1Output?: Stage1Output;
          stage2Output?: Stage2Output;
        };
        actionsTaken: string[];
        usageMetrics: MessageUsageMetric[];
      }
  > => {
    const timestamp = DateTime.now().toMillis();
    const endOfCurrentDayTs = DateTime.now()
      .setZone(params.userTz)
      .endOf('day')
      .toMillis();
    const systemPrompt = (CURRENT_STAGE: 'STAGE_1' | 'STAGE_2') => `
# HealthBot Agent Overview
The HealthBot system processes a user's message and determines the steps to take. There are 2 stages
1. STAGE_1: Process the user's message and return the list of actions to take.
2. STAGE_2: Review the actions taken and return a concise response to the user.

CURRENT DATE: ${params.currentDateStr}
CURRENT STAGE: ${CURRENT_STAGE}

## Allowed User intentions
Each user message can have multiple intentions. The following are the allowed intentions:

### ENUM: ${INTENTS.GET_GENERAL_ADVICE}
Respond with clear precise advice, favoring numbers and verified data backed by research.

### ENUM: ${INTENTS.ESTIMATE_CALORIES}
Estimate the calories for the user's input. Provide a range (min and max) for each item.

### ENUM: ${INTENTS.RECORD_WEIGHT}
Extract user's weight information if provided.

### ENUM: ${INTENTS.RECORD_MEALS_AND_CALORIES}
Extract the items the user has eaten and put in estimated calorie information. Provide a range (min and max) for each item.

### ENUM: ${INTENTS.RECORD_ACTIVITIES_AND_BURN}
Extract user's activity information and estimate calorie burn information if provided. Provide a range (min and max) for the calorie burn.

### ENUM: ${INTENTS.SET_TIMEZONE}
Set the user's timezone. The timezone should be in a standard format (e.g., 'America/New_York', 'Europe/London').

### ENUM: ${INTENTS.GET_WEEKLY_SUMMARY}
Generate a summary of the user's activity for the last week, including daily calorie intake, burn, deficit, and weight measurements.
Include the provided daily breakdown in the reply.

### ENUM: ${INTENTS.GET_DAILY_SUMMARY}
Generate a summary of the user's activity for today and yesterday, including calorie intake, burn, deficit, and weight measurements.
Compare today's performance with yesterday's.

### ENUM: ${INTENTS.EDIT_PREVIOUS_ACTION}
Detect if the user wants to edit a previous action (activity, meal, or weight). Inform the user that this feature is not currently supported.

### ENUM: ${INTENTS.SET_USER_GENDER}
Set the user's gender (male or female). This is used for BMR calculation.

### ENUM: ${INTENTS.SET_USER_AGE}
Set the user's age in years. This is used for BMR calculation.

### ENUM: ${INTENTS.SET_USER_HEIGHT}
Set the user's height in centimeters. This is used for BMR calculation.

## Examples
### Summary for last week or daily comparison
Date: 2023-05-01
  [Calories] 🍔 In: 1000 kcal, 🔥 Out: 2000 kcal, 👍🏼 Deficit: 1000 kcal
  [Weight] 💪🏼 Weight: 70 kg

  Date: 2023-05-02
  [Calories] 🍔 In: 2500 kcal, 🔥 Out: 2000 kcal, ⚠️ Deficit: -500 kcal
  [Weight] 💪🏼 Weight: 65 kg

Summary:
    Total Weight Lost: 5 kg
    Average Daily Calorie Deficit: 250 kcal

## Output Format for STAGE_2 
Plain text only. Do not use markdown.

`;
    let intermediates: {
      stage1Output?: z.infer<typeof stage1Output_zodSchema>;
      stage2Output?: z.infer<typeof stage2Output_zodSchema>;
      stage1Usage?: Awaited<ReturnType<typeof openAIParse>>['usage'];
      stage2Usage?: Awaited<ReturnType<typeof openAIParse>>['usage'];
    } = {};
    let actionsTaken: string[] = [];

    try {
      // Handle /start command
      if (params.inputText.trim().toLowerCase() === '/start') {
        const userDetails = await deps.getUserLatestState({
          userId: params.userId,
        });
        let isUserAccountReady = isUserReady(userDetails);
        let response = `Welcome! To get started, please set your timezone. You can say something like "set my timezone to Singapore".

I also need some information to calculate your Basal Metabolic Rate (BMR). Please provide the following details:

1. Your gender (male or female)
2. Your age in years
3. Your height in centimeters
4. Your weight in kilograms

You can respond with something like: "I'm a 30-year-old male, 175 cm tall."`;
        // if the user has provided all the required information, we can proceed
        if (isUserAccountReady) {
          response = ALL_SET_MESSAGE;
        }
        return {
          isError: false,
          intermediates: {
            stage1Output: { actions: [] },
            stage2Output: {
              response,
            },
          },
          actionsTaken: ['Handled /start command'],
          usageMetrics: [],
        };
      }

      const {
        response: { data: stage1Output },
        usage: stage1Usage,
      } = await openAIParse({
        systemPrompt: systemPrompt('STAGE_1'),
        text: params.inputText,
        schema: {
          name: 'user_health_information_stage_1',
          zod: stage1Output_zodSchema,
        },
      });
      // set the intermediate
      intermediates.stage1Output = stage1Output;

      await Promise.all(
        stage1Output.actions.map(async (action) => {
          switch (action.intent) {
            case INTENTS.RECORD_WEIGHT: {
              await deps.recordUserWeight({
                userId: params.userId,
                weight: action.weight,
                timestamp,
              });
              actionsTaken.push(
                `Recorded weight: ${action.weight.value} ${action.weight.units}`
              );
              break;
            }
            case INTENTS.RECORD_MEALS_AND_CALORIES: {
              const totalCalories = action.items.reduce(
                (state, item) => {
                  const average =
                    (item.estimatedCalories.min + item.estimatedCalories.max) /
                    2;
                  state['kcal'] += average;
                  return state;
                },
                {
                  'kcal': 0,
                }
              );
              const { intent: _, ...args } = action;
              await deps.recordUserMealAndCalories({
                ...args,
                totalCalories: {
                  value: Math.round(totalCalories['kcal']),
                  units: 'kcal',
                },
                items: action.items.map((item) => ({
                  ...item,
                  estimatedCalories: {
                    value:
                      Math.round(
                        item.estimatedCalories.min + item.estimatedCalories.max
                      ) / 2,
                    min: item.estimatedCalories.min,
                    max: item.estimatedCalories.max,
                    units: item.estimatedCalories.units,
                  },
                })),
                userId: params.userId,
                timestamp,
              });
              actionsTaken.push(
                `Recorded meal with calories: (${Math.round(totalCalories.kcal)} kcal)`
              );

              // Fetch and display daily summary
              const dailySummary = await deps.getLastNDaysSummary({
                numDays: 1,
                userId: params.userId,
                endOfCurrentDayTs,
                userTz: params.userTz,
              });
              const summaryText = formatSummary({
                type: 'daily',
                summary: dailySummary,
                userTz: params.userTz,
              });
              actionsTaken.push(
                `Daily progress after recording meal:\n${summaryText}`
              );
              break;
            }
            case INTENTS.RECORD_ACTIVITIES_AND_BURN: {
              const averageCaloriesBurned =
                (action.caloriesBurned.min + action.caloriesBurned.max) / 2;
              const { intent: _, ...args } = action;
              await deps.recordActivityAndBurn({
                ...args,
                caloriesBurned: {
                  value: Math.round(averageCaloriesBurned),
                  min: action.caloriesBurned.min,
                  max: action.caloriesBurned.max,
                  units: 'kcal',
                },
                userId: params.userId,
                timestamp,
              });
              actionsTaken.push(
                `Recorded activity: ${action.activity} (${Math.round(averageCaloriesBurned)} ${action.caloriesBurned.units} burned)`
              );

              // Fetch and display daily summary
              const dailySummary = await deps.getLastNDaysSummary({
                numDays: 1,
                userId: params.userId,
                endOfCurrentDayTs,
                userTz: params.userTz,
              });
              const summaryText = formatSummary({
                type: 'daily',
                summary: dailySummary,
                userTz: params.userTz,
              });
              actionsTaken.push(
                `Daily progress after recording activity:\n${summaryText}`
              );
              break;
            }
            case INTENTS.GET_GENERAL_ADVICE: {
              actionsTaken.push(`Received advice: ${action.advice}`);
              break;
            }
            case INTENTS.ESTIMATE_CALORIES: {
              const totalCalories = action.items.reduce(
                (state, item) => {
                  const average =
                    (item.estimatedCalories.min + item.estimatedCalories.max) /
                    2;
                  state['kcal'] += average;
                  return state;
                },
                {
                  'kcal': 0,
                }
              );
              actionsTaken.push(
                [
                  `Estimated calories: ${Math.round(totalCalories.kcal)} kcal`,
                  ...action.items.map((item) => [
                    `  - ${item.name}: ${item.estimatedCalories.min}-${item.estimatedCalories.max} ${item.estimatedCalories.units}`,
                  ]),
                ].join('\n')
              );
              break;
            }
            case INTENTS.SET_TIMEZONE: {
              const { intent: _, ...args } = action;
              await deps.setUserTimezone({
                ...args,
                userId: params.userId,
              });
              actionsTaken.push(`Set timezone: ${action.timezone}`);
              break;
            }
            case INTENTS.GET_WEEKLY_SUMMARY: {
              const summary = await deps.getLastNDaysSummary({
                numDays: 7,
                userId: params.userId,
                endOfCurrentDayTs,
                userTz: params.userTz,
              });
              const summaryText = formatSummary({
                type: 'weekly',
                summary,
                userTz: params.userTz,
              });
              actionsTaken.push(summaryText);
              break;
            }
            case INTENTS.GET_DAILY_SUMMARY: {
              const last2DaySummary = await deps.getLastNDaysSummary({
                numDays: 2,
                userId: params.userId,
                endOfCurrentDayTs,
                userTz: params.userTz,
              });
              const summaryText = formatSummary({
                type: 'daily',
                summary: last2DaySummary,
                userTz: params.userTz,
              });

              actionsTaken.push(summaryText);
              break;
            }
            case INTENTS.EDIT_PREVIOUS_ACTION: {
              actionsTaken.push(
                'Editing previous actions is not currently supported. I apologize for the inconvenience.'
              );
              break;
            }
            case INTENTS.SET_USER_GENDER: {
              await deps.setUserGender({
                userId: params.userId,
                gender: action.gender,
              });
              actionsTaken.push(`Set user gender: ${action.gender}`);
              break;
            }
            case INTENTS.SET_USER_AGE: {
              await deps.setUserAge({
                userId: params.userId,
                age: action.age,
              });
              actionsTaken.push(`Set user age: ${action.age}`);
              break;
            }
            case INTENTS.SET_USER_HEIGHT: {
              await deps.setUserHeight({
                userId: params.userId,
                height: action.height,
              });
              actionsTaken.push(
                `Set user height: ${action.height.value} ${action.height.units}`
              );
              break;
            }
            default: {
              // exhaustive switch
              const _: never = action;
            }
          }
        })
      );

      // onboarding: check if after the actions were taken, the user is ready to use the app
      const nextUserState = await deps.getUserLatestState({
        userId: params.userId,
      });
      const nextIsAccountReady = isUserReady(nextUserState);
      if (nextIsAccountReady) {
        actionsTaken.push('Account is ready to use the app!');
        actionsTaken.push(`Prepared message for the user: ${ALL_SET_MESSAGE}`);
      }

      // Stage 2 processing
      const {
        response: { data: stage2Output },
        usage: stage2Usage,
      } = await openAIParse({
        systemPrompt: systemPrompt('STAGE_2'),
        text: JSON.stringify({ userInput: params.inputText, actionsTaken }),
        schema: {
          name: 'user_health_information_stage_2',
          zod: stage2Output_zodSchema,
        },
      });

      // set the intermediate
      intermediates.stage2Output = stage2Output;

      return {
        isError: false,
        intermediates: {
          stage1Output,
          stage2Output,
        }, //used for debugging
        actionsTaken, //used for user response
        usageMetrics: [
          formatOpenAIUsage(stage1Usage, 'Stage 1 Usage'),
          formatOpenAIUsage(stage2Usage, 'Stage 2 Usage'),
        ],
      };
    } catch (error) {
      const usageMetrics: MessageUsageMetric[] = [];
      const { stage1Usage, stage2Usage } = intermediates;
      if (stage1Usage) {
        usageMetrics.push(formatOpenAIUsage(stage1Usage, 'Stage 1 usage'));
      }
      if (stage2Usage) {
        usageMetrics.push(formatOpenAIUsage(stage2Usage, 'Stage 2 usage'));
      }
      console.error('failed to process message.', error, intermediates);
      return {
        isError: true,
        intermediates,
        actionsTaken: [],
        usageMetrics,
      };
    }
  };

function formatOpenAIUsage(
  usage: Awaited<ReturnType<typeof openAIParse>>['usage'],
  title: string
): MessageUsageMetric {
  return {
    type: 'openai',
    title,
    openAI: {
      tokens: {
        prompt: usage.tokens.prompt,
        completion: usage.tokens.completion,
        total: usage.tokens.total,
      },
      cost: {
        currency: 'USD',
        total: usage.cost.total,
        input: usage.cost.input,
        output: usage.cost.output,
      },
    },
  };
}

function formatSummary(params: {
  type: 'weekly' | 'daily';
  summary: GetLastNDaysSummaryResult;
  userTz: string;
}) {
  let resultLines = [`${params.type} summary:\n\n`];

  for (let dailySummary of params.summary.dailySummaries) {
    resultLines.push(`Date: ${dailySummary.date}`);
    if (!dailySummary.hasData) {
      resultLines.push('  No data recorded.');
      continue;
    }

    if (dailySummary.caloriesIn) {
      resultLines.push(
        `  Calories In: ${dailySummary.caloriesIn.value} ${dailySummary.caloriesIn.units}`
      );
    }
    if (dailySummary.caloriesOut) {
      resultLines.push(
        `  Calories Out: ${dailySummary.caloriesOut.value} ${dailySummary.caloriesOut.units}`
      );
    }
    if (dailySummary.deficit) {
      resultLines.push(
        `  Deficit: ${dailySummary.deficit.value} ${dailySummary.deficit.units}`
      );
    }
    if (dailySummary.weight) {
      resultLines.push(
        `  Weight: ${dailySummary.weight.value} ${dailySummary.weight.units}`
      );
    }
  }

  // Summary across all days
  resultLines.push(`Summary Across All Days:`);
  if (params.summary.overview?.weightLost) {
    resultLines.push(
      `  Weight Lost: ${params.summary.overview.weightLost.value} ${params.summary.overview.weightLost.units}`
    );
  }
  if (params.summary.overview?.averageCalorieDeficit) {
    resultLines.push(
      `  Average Daily Calorie Deficit: ${params.summary.overview.averageCalorieDeficit.value.toFixed(2)} ${params.summary.overview.averageCalorieDeficit.units}`
    );
  }
  console.log('debug:', resultLines.join('\n'));
  return resultLines.join('\n');
}
