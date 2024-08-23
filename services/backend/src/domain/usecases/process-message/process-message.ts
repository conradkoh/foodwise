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

export const processMessage =
  (deps: {
    recordUserWeight: (weight: { value: number; units: 'kg' }) => Promise<void>;
    recordUserMealAndCalories: (v: {
      meal: string;
      items: {
        name: string;
        estimatedCalories: {
          value: number;
          units: 'kcal';
        };
      }[];
      totalCalories: {
        value: number;
        units: 'kcal';
      };
    }) => Promise<void>;
    recordActivityAndBurn: (v: {
      activity: string;
      caloriesBurned: {
        value: number;
        units: 'kcal';
      };
    }) => Promise<void>;
    getUserTimezone: () => Promise<string | undefined>;
    setUserTimezone: (timezone: string) => Promise<void>;
  }) =>
  async (params: {
    inputText: string;
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
    const systemPrompt = (CURRENT_STAGE: 'STAGE_1' | 'STAGE_2') => `
# HealthBot Agent Overview
The HealthBot system processes a user's message and determines the steps to take. There are 2 stages
1. STAGE_1: Process the user's message and return the list of actions to take.
2. STAGE_2: Review the actions taken and return a concise response to the user.

CURRENT STAGE: ${CURRENT_STAGE}

## Allowed User intentions
Each user message can have multiple intentions. The following are the allowed intentions:

### ENUM: ${INTENTS.GET_GENERAL_ADVICE}
Respond with clear precise advice, favoring numbers and verified data backed by research.

### ENUM: ${INTENTS.ESTIMATE_CALORIES}
Estimate the calories for the user's input.

### ENUM: ${INTENTS.RECORD_WEIGHT}
Extract user's weight information if provided.

### ENUM: ${INTENTS.RECORD_MEALS_AND_CALORIES}
Extract user's mean and put in estimated calorie information.

### ENUM: ${INTENTS.RECORD_ACTIVITIES_AND_BURN}
Extract user's activity information and estimate calorie burn information if provided.

### ENUM: ${INTENTS.SET_TIMEZONE}
Set the user's timezone. The timezone should be in a standard format (e.g., 'America/New_York', 'Europe/London').

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
        const timezone = await deps.getUserTimezone();
        let response = `Welcome! To get started, please set your timezone. You can say something like "set my timezone to Singapore".`;
        if (timezone) {
          response = `
You're all good to go! 👍🏼

In this chat, I can help you with a variety of tasks to help you keep track of your health!

Here are some things I can help with
  1. Keep track of your weight ⚖️
  2. Keep track of your meals and calories 🥗🌯
  3. Keep track of your activities and calorie burn 🏃🏻‍♂️🏃🏽‍♀️🔥
  4. Set your timezone 🕥

I can also provide you with general advice and estimate calories for your meals.
`.trim();
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
              await deps.recordUserWeight(action.weight);
              actionsTaken.push(
                `Recorded weight: ${action.weight.value} ${action.weight.units}`
              );
              break;
            }
            case INTENTS.RECORD_MEALS_AND_CALORIES: {
              const totalCalories = action.items.reduce(
                (state, item) => {
                  switch (item.estimatedCalories.units) {
                    case 'kcal': {
                      state['kcal'] += item.estimatedCalories.value;
                      break;
                    }
                    default: {
                      // exhaustive switch for units
                      const _: never = item.estimatedCalories.units;
                    }
                  }
                  return state;
                },
                {
                  'kcal': 0,
                }
              );
              await deps.recordUserMealAndCalories({
                ...action,
                totalCalories: {
                  value: totalCalories['kcal'],
                  units: 'kcal',
                },
              });
              actionsTaken.push(
                `Recorded meal: ${action.meal} (${totalCalories.kcal} kcal`
              );
              break;
            }
            case INTENTS.RECORD_ACTIVITIES_AND_BURN: {
              await deps.recordActivityAndBurn(action);
              actionsTaken.push(
                `Recorded activity: ${action.activity} (${action.caloriesBurned.value} ${action.caloriesBurned.units} burned)`
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
                  switch (item.estimatedCalories.units) {
                    case 'kcal': {
                      state['kcal'] += item.estimatedCalories.value;
                      break;
                    }
                    default: {
                      // exhaustive switch for units
                      const _: never = item.estimatedCalories.units;
                    }
                  }
                  return state;
                },
                {
                  'kcal': 0,
                }
              );
              actionsTaken.push(
                [
                  `Estimated calories: ${totalCalories.kcal} kcal`,
                  ...action.items.map((item) => [
                    `  - ${item.name}: ${item.estimatedCalories.value} ${item.estimatedCalories.units}`,
                  ]),
                ].join('\n')
              );
              break;
            }
            case INTENTS.SET_TIMEZONE: {
              await deps.setUserTimezone(action.timezone);
              actionsTaken.push(`Set timezone: ${action.timezone}`);
              break;
            }

            default: {
              // exhaustive switch
              const _: never = action;
            }
          }
        })
      );

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
