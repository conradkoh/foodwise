import { INTENTS } from '@/domain/usecases/process-message/intent';
import { stage1Output_zodSchema } from '@/domain/usecases/process-message/schemas/stage_1';
import { stage2Output_zodSchema } from '@/domain/usecases/process-message/schemas/stage_2';
import { openAIParse } from '@/utils/openai';

export const processMessage =
  (deps: {
    recordUserWeight: (weight: { value: number; units: 'kg' }) => Promise<void>;
    recordUserMealAndCalories: (v: {
      meal: string;
      calories: {
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
  }) =>
  async (params: { inputText: string }) => {
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
Estimate the calories for the user's meal.

### ENUM: ${INTENTS.RECORD_WEIGHT}
Extract user's weight information if provided.

### ENUM: ${INTENTS.RECORD_MEALS_AND_CALORIES}
Extract user's meal and estimate calorie intake information if provided. 

### ENUM: ${INTENTS.RECORD_ACTIVITIES_AND_BURN}
Extract user's activity information and estimate calorie burn information if provided.
`;

    const stage1Output = await openAIParse({
      systemPrompt: systemPrompt('STAGE_1'),
      text: params.inputText,
      schema: {
        name: 'user_health_information_stage_1',
        zod: stage1Output_zodSchema,
      },
    });

    const actionsTaken = await Promise.all(
      stage1Output.response.data.actions.map(async (action) => {
        switch (action.intent) {
          case INTENTS.RECORD_WEIGHT: {
            await deps.recordUserWeight(action.weight);
            return `Recorded weight: ${action.weight.value} ${action.weight.units}`;
          }
          case INTENTS.RECORD_MEALS_AND_CALORIES: {
            await deps.recordUserMealAndCalories(action);
            return `Recorded meal: ${action.meal} (${action.calories.value} ${action.calories.units})`;
          }
          case INTENTS.RECORD_ACTIVITIES_AND_BURN: {
            await deps.recordActivityAndBurn(action);
            return `Recorded activity: ${action.activity} (${action.caloriesBurned.value} ${action.caloriesBurned.units} burned)`;
          }
          case INTENTS.GET_GENERAL_ADVICE: {
            return `Received advice: ${action.advice}`;
          }
          case INTENTS.ESTIMATE_CALORIES: {
            return `Estimated calories: ${action.estimatedCalories.value} ${action.estimatedCalories.units}`;
          }
          default: {
            // exhaustive switch
            const _: never = action;
          }
        }
      })
    );

    // Stage 2 processing
    const stage2Output = await openAIParse({
      systemPrompt: systemPrompt('STAGE_2'),
      text: JSON.stringify({ userInput: params.inputText, actionsTaken }),
      schema: {
        name: 'user_health_information_stage_2',
        zod: stage2Output_zodSchema,
      },
    });

    return {
      stage1Output,
      stage2Output,
      actionsTaken,
    };
  };
