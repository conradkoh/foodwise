import { dailySummary_zodSchema } from '@/domain/entities/daily_summary';
import { z } from 'zod';

export type WeeklySummary = z.infer<typeof weeklySummary_zodSchema>;
//zod
export const weeklySummary_zodSchema = z.object({
  dailySummaries: z.array(dailySummary_zodSchema),
  weightChange: z.object({
    value: z.number(),
    units: z.literal('kg'),
  }),
  averageCalorieDeficit: z.object({
    value: z.number(),
    units: z.literal('kcal'),
  }),
});
