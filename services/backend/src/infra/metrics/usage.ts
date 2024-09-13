import type { MessageUsageMetric } from "@/domain/entities/message";
import type { openAIParse } from "@/utils/openai";

/**
 * Formats usage for a message
 * @param usage
 * @param title
 * @returns
 */
export function formatUsage(usage: {
	type: "openai";
	data: Awaited<ReturnType<typeof openAIParse>>["usage"];
	title: string;
}): MessageUsageMetric {
	return {
		type: "openai",
		title: usage.title,
		openAI: {
			tokens: {
				prompt: usage.data.tokens.prompt,
				completion: usage.data.tokens.completion,
				total: usage.data.tokens.total,
			},
			cost: {
				currency: "USD",
				total: usage.data.cost.total,
				input: usage.data.cost.input,
				output: usage.data.cost.output,
			},
		},
	};
}
