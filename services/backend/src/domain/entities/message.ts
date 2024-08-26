import { zid, zodToConvex } from "convex-helpers/server/zod";
import { z } from "zod";

//========================================
// Usage Metrics
//========================================
export type MessageUsageMetric = z.infer<typeof messageUsageMetric_zodSchema>;

const messageUsageMetric_zodSchema = z.object({
	type: z.literal("openai"),
	title: z.string(),
	openAI: z.object({
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
	}),
});

export const messageUsageMetric_convexSchema = zodToConvex(
	messageUsageMetric_zodSchema,
);

//========================================
// Message
//========================================
export type Message = z.infer<typeof message_zodSchema>;

// zod schema
const message_zodSchema = z.object({
	userId: zid("user"),
	source: z.literal("telegram"),
	status: z.union([z.literal("processed"), z.literal("failed")]),
	rawPayload: z.any(),
	intermediates: z.optional(z.any()),
	fetchedData: z.optional(z.any()),
	response: z.optional(z.string()),
	totalCostEstimated: z.optional(
		// aggregate by currency
		z.array(
			z.object({
				value: z.number(),
				currency: z.literal("USD"),
			}),
		),
	),
	usageMetrics: z.optional(z.array(messageUsageMetric_zodSchema)),
});

// convex
export const message_convexSchema = zodToConvex(message_zodSchema);
