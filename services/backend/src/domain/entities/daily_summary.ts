import { z } from "zod";

export type DailySummary = z.infer<typeof dailySummary_zodSchema>;

//zod
export const dailySummary_zodSchema = z.object({
	date: z.string(), //date in format 'YYYY-MM-DD'
	dayOfWeek: z.string().brand("format=ccc"),
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
