import { describe, expect, test } from "vitest";
import { aggregateUsage } from "./_usage";

describe("Usage Aggregation", () => {
	test("aggregates usage", () => {
		const usage = [
			{
				tokens: {
					prompt: 100,
					completion: 200,
					total: 300,
				},
				cost: {
					currency: "USD" as const,
					total: 300,
					input: 100,
					output: 200,
				},
			},
			{
				tokens: {
					prompt: 100,
					completion: 200,
					total: 300,
				},
				cost: {
					currency: "USD" as const,
					total: 110,
					input: 50,
					output: 60,
				},
			},
			{
				tokens: {
					prompt: 100,
					completion: 200,
					total: 300,
				},
				cost: {
					currency: "USD" as const,
					total: 45,
					input: 15,
					output: 30,
				},
			},
		];
		const result = aggregateUsage(usage);
		expect(result.tokens.prompt).toBe(300);
		expect(result.tokens.completion).toBe(600);
		expect(result.tokens.total).toBe(900);
		expect(result.cost.currency).toBe("USD");
		expect(result.cost.total).toBe(455);
		expect(result.cost.input).toBe(165);
		expect(result.cost.output).toBe(290);
	});
});
