import {
	YMD_DATE_FORMAT_BRAND,
	DAY_OF_WEEK_FORMAT_BRAND,
} from "@/domain/usecases/process-message/messages/format/date";
import { z } from "zod";

export type DailySummary = z.infer<typeof dailySummary_zodSchema>;

//zod
export const dailySummary_zodSchema = z.object({
	date: z.string().brand(YMD_DATE_FORMAT_BRAND), //date in format 'YYYY-MM-DD'
	dayOfWeek: z.string().brand(DAY_OF_WEEK_FORMAT_BRAND),
	dateTs: z.number(),
	caloriesIn: z.optional(
		z.object({
			value: z.number(),
			units: z.literal("kcal"),
		}),
	),
	caloriesOut: z.optional(
		z.object({
			value: z.number(),
			units: z.literal("kcal"),
		}),
	),
	deficit: z.optional(
		z.object({
			value: z.number(),
			units: z.literal("kcal"),
		}),
	),
	weight: z.optional(
		z.object({
			value: z.number(),
			units: z.literal("kg"),
		}),
	),
	firstMorningWeight: z.optional(
		z.object({
			value: z.number(),
			units: z.literal("kg"),
		}),
	),
	lastEveningWeight: z.optional(
		z.object({
			value: z.number(),
			units: z.literal("kg"),
		}),
	),
	hasData: z.boolean(),
});
