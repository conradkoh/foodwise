import { zodToConvex } from "@/utils/convex";
import { MODEL_PRICING } from "@/utils/openai/_models";
import type { OpenAIModel } from "@/utils/openai/_models";
import type OpenAI from "openai";
import { z } from "zod";

/**
 * Estimate the cost of a given chat completion
 * @param model
 * @param chatCompletion
 * @returns
 */
export function getUsage(
	model: OpenAIModel,
	chatCompletion: Pick<OpenAI.ChatCompletion, "usage">,
): OpenAICompletionUtilization {
	const pricing = MODEL_PRICING[model];
	if (!pricing) {
		throw new Error(`Model ${model} is not supported`);
	}
	const costEstimates = {
		input:
			(chatCompletion.usage?.prompt_tokens || 0) *
			(pricing.input.costPerMillionTokensUSD / 1_000_000),
		output:
			(chatCompletion.usage?.completion_tokens || 0) *
			(pricing.output.costPerMillionTokensUSD / 1_000_000),
	};

	return {
		tokens: {
			prompt: chatCompletion.usage?.prompt_tokens || 0,
			completion: chatCompletion.usage?.completion_tokens || 0,
			total: chatCompletion.usage?.total_tokens || 0,
		},
		cost: {
			input: costEstimates.input,
			output: costEstimates.output,
			total: costEstimates.input + costEstimates.output,
			currency: "USD" as const,
		},
	};
}

//========================================
// Types
//========================================
export type OpenAICompletionUtilization = z.infer<
	typeof openAICompletionUtilization_zodSchema
>;
// zod
const openAICompletionUtilization_zodSchema = z.object({
	tokens: z.object({
		prompt: z.number(),
		completion: z.number(),
		total: z.number(),
	}),
	cost: z.object({
		currency: z.literal("USD"),
		total: z.number(),
		input: z.number(),
		output: z.number(),
	}),
});

// convex
export const openAICompletionUtilization_convexSchema = zodToConvex(
	openAICompletionUtilization_zodSchema,
);
