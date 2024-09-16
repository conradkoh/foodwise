import { describe, expect, test } from "vitest";
import { DateInferrer } from "./infer-date";
import { DateTime } from "luxon";
import type { BRAND } from "zod";
import { Message, MessageUsageMetric } from "@/domain/entities/message";
import type { ConstructorOf } from "@/utils/typescript";

describe("Date Inference", () => {
	test("parses date", async () => {
		const val = "2024-09-15 23:17:40";
		const date = DateInferrer.ParseDate(val);
		expect(date.isValid).toBe(true);
		expect(date.hour).toBe(23);
		expect(date.minute).toBe(17);
		expect(date.second).toBe(40);
	});
	test("SetDateInfo", async () => {
		const date = DateTime.fromFormat(
			"2024-09-15 23:17:40",
			"yyyy-MM-dd HH:mm:ss",
		);
		const dateInfo = "2024-09-15" as string & BRAND<"dateFormat=yyyy-MM-dd">;
		const result = DateInferrer._SetDateInfo(date, dateInfo);
		expect(result.isValid).toBe(true);
		expect(result.hour).toBe(23);
		expect(result.minute).toBe(17);
		expect(result.second).toBe(40);
	});
	test("SetTimeInfo", async () => {
		const date = DateTime.fromFormat(
			"2024-09-15 23:17:40",
			"yyyy-MM-dd HH:mm:ss",
		);
		const timeInfo = "23:17:40" as string & BRAND<"dateFormat=HH:mm:ss">;
		const result = DateInferrer._SetTimeInfo(date, timeInfo);
		expect(result.isValid).toBe(true);
		expect(result.hour).toBe(23);
		expect(result.minute).toBe(17);
		expect(result.second).toBe(40);
	});
});

describe("DateInferrer.inferDate", () => {
	type ConstructorParams = ConstructorOf<typeof DateInferrer>[0];
	type InferDateParams = Parameters<typeof DateInferrer.prototype.inferDate>[0];
	type InferDateResult = ReturnType<typeof DateInferrer.prototype.inferDate>;
	type OpenAIParseResponse = Awaited<
		ReturnType<ConstructorParams["openAIParse"]>
	>;
	type Scenario = {
		test: string;
		message: InferDateParams["message"];
		currentDateStr: InferDateParams["currentDateStr"];

		// ai response
		mock: {
			openAIParseResponse: OpenAIParseResponse;
		};

		// result
		result: Awaited<InferDateResult>;
	};
	const mockUsage: OpenAIParseResponse["usage"] = {
		tokens: {
			prompt: 0,
			completion: 0,
			total: 0,
		},
		cost: {
			currency: "USD",
			total: 0,
			input: 0,
			output: 0,
		},
	};
	const matrix: Scenario[] = [
		{
			test: "openAIParse returns date only",
			message: "at meal on 12 Sep",
			currentDateStr: "2024-09-15 23:17:40" as string &
				BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss & tz=user">,

			// mock external dependencies
			mock: {
				openAIParseResponse: {
					response: {
						data: [
							{
								type: "date",
								date: "2024-09-12",
							},
						],
					},
					usage: mockUsage,
				},
			},
			result: {
				forDate: "2024-09-12 23:17:40" as string &
					BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss">,
				_usage: {} as any, //ignore this for the test
			},
		},
		{
			test: "openAIParse returns date and time",
			message: "at meal on 12 Sep at 8am",
			currentDateStr: "2024-09-15 23:17:40" as string &
				BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss & tz=user">,
			// mock external dependencies
			mock: {
				openAIParseResponse: {
					response: {
						data: [
							{
								type: "date",
								date: "2024-09-12",
							},
							{
								type: "time",
								time: "08:00:00",
							},
						],
					},
					usage: mockUsage,
				},
			},
			result: {
				forDate: "2024-09-12 08:00:00" as string &
					BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss">,
				_usage: {} as any, //ignore this for the test
			},
		},
		{
			test: "openAIParse returns time only",
			message: "at 8am",
			currentDateStr: "2024-09-15 23:17:40" as string &
				BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss & tz=user">,
			// mock external dependencies
			mock: {
				openAIParseResponse: {
					response: {
						data: [
							{
								type: "time",
								time: "08:00:00",
							},
						],
					},
					usage: mockUsage,
				},
			},
			result: {
				forDate: "2024-09-15 08:00:00" as string &
					BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss">,
				_usage: {} as any, //ignore this for the test
			},
		},
	];
	// create matrix
	for (const scenario of matrix) {
		test(scenario.test, async () => {
			const dateInferrer = new DateInferrer({
				openAIParse: async () =>
					Promise.resolve(scenario.mock.openAIParseResponse) as any,
			});
			const result = await dateInferrer.inferDate({
				message: scenario.message,
				currentDateStr: scenario.currentDateStr,
			});
			expect(result.forDate).toBe(scenario.result.forDate);
		});
	}
});
