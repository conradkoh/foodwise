import OpenAI from 'openai';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

export const openAIParse = async <T extends z.ZodType>(p: {
  systemPrompt: string;
  text: string; //the input text to be sent
  schema: {
    name: string; //The name of the schema that gives context to the data that the response should contain
    zod: T;
  };
}) => {
  const client = new OpenAI();
  const schema = z.object({
    data: p.schema.zod,
  });
  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: 'system', content: p.systemPrompt },
      { role: 'user', content: p.text },
    ],
    model: 'gpt-4o-2024-08-06',
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: p.schema.name,
        schema: zodToJsonSchema(schema),
      },
    },
  });

  // parse the response
  const contentRaw = chatCompletion.choices[0].message.content;
  if (!contentRaw) throw new Error('Null response from OpenAI');

  const res: z.infer<typeof schema> = JSON.parse(contentRaw);

  // detect api utilization and estimate cost
  const costEstimates = {
    input: (chatCompletion.usage?.prompt_tokens || 0) * (2.5 / 1000000),
    output: (chatCompletion.usage?.completion_tokens || 0) * (10 / 1000000),
  };
  const usage = {
    ...chatCompletion.usage,
    costEstimatesUSD: {
      ...costEstimates,
      total: costEstimates.input + costEstimates.output,
    },
  };
  return {
    response: res,
    usage,
  };
};
