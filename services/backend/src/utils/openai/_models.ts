export enum OpenAIModel {
	GPT_4o = "gpt-4o-2024-08-06",
	GPT_4o_mini = "gpt-4o-mini-2024-07-18",
}

/**
 * Snapshot taken from https://openai.com/api/pricing/
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
	[OpenAIModel.GPT_4o]: {
		input: {
			costPerMillionTokensUSD: 2.5,
		},
		output: {
			costPerMillionTokensUSD: 10,
		},
	},
	[OpenAIModel.GPT_4o_mini]: {
		input: {
			costPerMillionTokensUSD: 0.015,
		},
		output: {
			costPerMillionTokensUSD: 0.6,
		},
	},
};

interface ModelPricing {
	input: {
		costPerMillionTokensUSD: number;
	};
	output: {
		costPerMillionTokensUSD: number;
	};
}
