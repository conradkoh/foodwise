import { formatUsage } from "@/infra/metrics/usage";
import type { openAIParse } from "@/utils/openai";
import { DateTime } from "luxon";
import { type BRAND, z } from "zod";

type InferDateParams = {
	currentDateStr: string & BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss & tz=user">;
	message: string;
};

export class DateInferrer {
	static INFER_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss" as const;
	static ParseDate(date: string) {
		return DateTime.fromFormat(date, DateInferrer.INFER_DATE_FORMAT);
	}

	constructor(private deps: { openAIParse: typeof openAIParse }) {}

	async inferDate(params: InferDateParams) {
		const { message, currentDateStr } = params;
		const INFER_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss" as const;
		const response = await this.deps.openAIParse({
			systemPrompt: INFER_DATE_PROMPT({
				currentDateStr: currentDateStr,
				message,
			}),
			text: message,
			schema: {
				name: "infer_date",
				zod: inferDateReturn_zodSchema,
			},
		});
		let forDate = DateInferrer.ParseDate(currentDateStr);
		if (!forDate.isValid) {
			throw new Error(
				"container.inferDate() - Invalid date format: " + currentDateStr,
			);
		}
		const dateInfo = response.response.data.filter(
			(info) => info.type === "date",
		);
		if (dateInfo[0]) {
			forDate = DateInferrer._SetDateInfo(forDate, dateInfo[0].date);
		}
		const timeInfo = response.response.data.filter(
			(info) => info.type === "time",
		);
		if (timeInfo[0]) {
			forDate = DateInferrer._SetTimeInfo(forDate, timeInfo[0].time);
		}

		return {
			forDate: forDate.toFormat(INFER_DATE_FORMAT) as string &
				BRAND<`dateFormat=${typeof INFER_DATE_FORMAT}`>,
			_usage: formatUsage({
				type: "openai",
				data: response.usage,
				title: "Infer Date",
			}),
		};
	}

	static _SetDateInfo(
		d: DateTime,
		dateInfo: string & BRAND<"dateFormat=yyyy-MM-dd">,
	) {
		const date = DateTime.fromFormat(dateInfo, "yyyy-MM-dd");
		return d.set({
			year: date.year,
			month: date.month,
			day: date.day,
		});
	}
	static _SetTimeInfo(
		d: DateTime,
		timeInfo: string & BRAND<"dateFormat=HH:mm:ss">,
	) {
		const time = DateTime.fromFormat(timeInfo, "HH:mm:ss");
		return d.set({
			hour: time.hour,
			minute: time.minute,
			second: time.second,
		});
	}
}

export const INFER_DATE_PROMPT = (p: InferDateParams) => {
	return `
## Goal
Infer the date from the user's message.

## Context
Current date: ${p.currentDateStr}

## Format
Date Format: yyyy-MM-dd
Time Format: HH:mm:ss

### User's Message
${p.message}

## Output:

`.trim();
};
export const inferDateReturn_zodSchema = z.array(
	z.union([
		z.object({
			type: z.literal("date"),
			date: z
				.string()
				.brand("dateFormat=yyyy-MM-dd")
				.describe("The date in yyyy-MM-dd format"),
		}),
		z.object({
			type: z.literal("time"),
			time: z
				.string()
				.brand("dateFormat=HH:mm:ss")
				.describe("The time in HH:mm:ss format"),
		}),
	]),
);
