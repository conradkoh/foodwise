import { INTENTS } from '@/domain/usecases/process-message/intent';
import { z } from 'zod';
export type Stage1Output = z.infer<typeof stage1Output_zodSchema>;
export const stage1Output_zodSchema = z.array(
  z.object({
    intent: z.enum([
      INTENTS.GET_GENERAL_ADVICE,
      INTENTS.ESTIMATE_CALORIES,
      INTENTS.RECORD_WEIGHT,
      INTENTS.RECORD_MEALS_AND_CALORIES,
      INTENTS.RECORD_ACTIVITIES_AND_BURN,
    ]),
    result: z.object({
      [INTENTS.GET_GENERAL_ADVICE]: z.string().optional(),
      [INTENTS.ESTIMATE_CALORIES]: z
        .object({
          calories: z.object({
            units: z.literal('kcal'),
            value: z.number().optional(),
          }),
        })
        .optional(),
      [INTENTS.RECORD_WEIGHT]: z.object({
        weight: z.object({
          units: z.literal('kg'),
          value: z.number().optional(),
        }),
      }),
      [INTENTS.RECORD_MEALS_AND_CALORIES]: z
        .object({
          meals: z.array(
            z.object({
              name: z.string(),
              description: z.string().optional(),
              calories: z.object({
                units: z.literal('kcal'),
                value: z.number().optional(),
              }),
            })
          ),
        })
        .optional(),
      [INTENTS.RECORD_ACTIVITIES_AND_BURN]: z.object({
        activity: z.array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            calories: z.object({
              units: z.literal('kcal'),
              value: z.number().optional(),
            }),
          })
        ),
      }),
    }),
  })
);
