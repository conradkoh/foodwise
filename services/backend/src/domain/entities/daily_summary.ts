import { z } from 'zod';

export type DailySummary = z.infer<typeof dailySummary_zodSchema>;

//zod
export const dailySummary_zodSchema = z.object({
  range: z.object({
    start: z.object({
      ts: z.number(),
      str: z.string().describe('Formatted date string'),
    }),
    end: z.object({
      ts: z.number(),
      str: z.string().describe('Formatted date string'),
    }),
  }),
  caloriesIn: z.optional(
    z.object({
      value: z.number(),
      units: z.literal('kcal'),
    })
  ),
  caloriesOut: z.optional(
    z.object({
      value: z.number(),
      units: z.literal('kcal'),
    })
  ),
  deficit: z.optional(
    z.object({
      value: z.number(),
      units: z.literal('kcal'),
    })
  ),
  weight: z.optional(
    z.object({
      value: z.number(),
      units: z.literal('kg'),
    })
  ),
  hasData: z.boolean(),
});
