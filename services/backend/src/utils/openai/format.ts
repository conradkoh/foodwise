import { OpenAIModel } from "@/utils/openai/_models";
import { getUsage } from "@/utils/openai/_usage";
import OpenAI from "openai";
import { z } from "zod";

/**
 * Formats a response into human readable text
 * @param params
 * @returns
 */
export const openAIFormat = async (params: OpenAIFormatParams) => {
	const client = new OpenAI();
	const chatCompletion = await client.chat.completions.create({
		model: OpenAIModel.GPT_4o_mini, // unpinned version
		messages: [
			{
				role: "system",
				content: `
You are an assistant helping with formatting text to be communicated to users. Use emojis where appropriate to convey emotions. Ensure that messages are well structured and have good readability.
`.trim(),
			},
			{ role: "system", content: params.systemPrompt },
			{
				role: "system",
				content: `
Here are some examples:
${formatExamples(params.examples)}
`,
			},
			{
				role: "assistant",
				content: `Ok. I'll keep my responses short and concise and use emojis! 👍🏼`,
			},
			{ role: "user", content: params.text },
		],
		temperature: (params.temperature / 100) * 2, //remap from 0-100 to 0-2
		max_tokens: params.maxTokens,
	});

	const usage = getUsage(OpenAIModel.GPT_4o_mini, chatCompletion);
	return {
		response: {
			data: chatCompletion.choices[0]?.message?.content || "",
		},
		usage,
	};
};

function formatExamples(examples: OpenAIFormatParams["examples"]) {
	if (!examples) return "Not available";
	return examples
		.map((example) => `## ${example.title}\n${example.content}`)
		.join("\n");
}

//========================================
// Types
//========================================

type OpenAIFormatParams = z.infer<typeof openAIFormatParams_zodSchema>;

// zod
const openAIFormatParams_zodSchema = z.object({
	systemPrompt: z.string(),
	text: z.string(),
	type: z.literal("fast"),
	maxTokens: z.optional(z.number()),
	temperature: z.number(),
	examples: z.optional(
		z.array(
			z.object({
				title: z.string(),
				content: z.string(),
			}),
		),
	),
});

// convex
export const formatOpenAI = openAIFormat;
