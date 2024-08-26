import { z } from 'zod';

//========================================
// System Usage
//========================================
export type SystemUsage = z.infer<typeof systemUsage_zodSchema>;

// zod
export const systemUsage_zodSchema = z.object({
  cycle: z.object({
    year: z.number(),
    month: z.number(),
  }),
  totalCost: z.array(
    z.object({
      currency: z.string(),
      value: z.number(),
    })
  ),
});
