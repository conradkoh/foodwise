import { INTENTS } from '@/domain/usecases/process-message/intent';
import { stage1Output_zodSchema } from '@/domain/usecases/process-message/schemas/stage_1';
import { openAIParse } from '@/utils/openai';

export const processMessage =
  (deps: {}) => async (params: { inputText: string }) => {
    const systemPrompt = (CURRENT_STAGE: 'STAGE_1' | 'STAGE_2') => `
# HealthBot Agent Overview
The HealthBot system processes a user's message and determines the steps to take. There are 2 stages
1. STAGE_1: Process the user's message and return the list of actions to take.
2. STAGE_2: Review the actions taken and return a response to the user.

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

    return stage1Output;
  };
