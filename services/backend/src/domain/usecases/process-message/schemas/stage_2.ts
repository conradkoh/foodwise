import { z } from 'zod';

export const stage2Output_zodSchema = z.object({
  response: z
    .string()
    .describe(
      'A well-crafted response to the user, summarizing the actions taken and providing any relevant advice or information'
    ),
});

export type Stage2Output = z.infer<typeof stage2Output_zodSchema>;
