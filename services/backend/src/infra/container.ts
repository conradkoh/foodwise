import type { MessageUsageMetric } from "@/domain/entities/message";
import {
	INFER_DATE_PROMPT,
	inferDateReturn_zodSchema,
} from "@/domain/usecases/process-message/prompts/infer-date";
import { formatUsage } from "@/infra/metrics/usage";
import { bindMutation, bindQuery } from "@/utils/convex";
import type { BoundMutation, BoundQuery } from "@/utils/convex";
import { openAIParse } from "@/utils/openai";
import { internal } from "convex/_generated/api";
import type { GenericActionCtx } from "convex/server";
import type { BRAND } from "zod";

/**
 * A container for all the dependencies of the application
 */
export type Container = {
	setUserHeight: BoundMutation<typeof internal.user._setUserHeight>;
	setUserGender: BoundMutation<typeof internal.user._setUserGender>;
	setUserAge: BoundMutation<typeof internal.user._setUserAge>;
	setUserTimezone: BoundMutation<typeof internal.user._setUserTimezone>;
	recordUserWeight: BoundMutation<typeof internal.user._recordUserWeight>;
	recordUserMealAndCalories: BoundMutation<
		typeof internal.user._recordUserMealAndCalories
	>;
	recordActivityAndBurn: BoundMutation<
		typeof internal.user._recordActivityAndBurn
	>;
	getLastNDaysSummary: BoundQuery<typeof internal.user._getLastNDaysSummary>;
	getUserLatestState: BoundQuery<typeof internal.user._getUser>;

	// ai
	inferDate: (p: InferDateParams) => Promise<{
		forDate: string & BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss">;
		_usage: MessageUsageMetric;
	}>;
};

type InferDateParams = {
	currentDateStr: string & BRAND<"dateFormat=dd MMM yyyy HH:mm & tz=user">;
	message: string;
};

/**
 * Constructor for the container
 * @param ctx
 * @param overrides
 * @returns
 */
export const createContainer = <T extends Container>(
	ctx: GenericActionCtx<any>,
	overrides?: (container: Container) => T,
): T => {
	const container: Container = {
		// user
		setUserHeight: bindMutation(ctx, internal.user._setUserHeight),
		setUserGender: bindMutation(ctx, internal.user._setUserGender),
		setUserAge: bindMutation(ctx, internal.user._setUserAge),
		setUserTimezone: bindMutation(ctx, internal.user._setUserTimezone),
		recordUserWeight: bindMutation(ctx, internal.user._recordUserWeight),
		recordUserMealAndCalories: bindMutation(
			ctx,
			internal.user._recordUserMealAndCalories,
		),
		recordActivityAndBurn: bindMutation(
			ctx,
			internal.user._recordActivityAndBurn,
		),
		getLastNDaysSummary: bindQuery(ctx, internal.user._getLastNDaysSummary),
		getUserLatestState: bindQuery(ctx, internal.user._getUser),

		// ai
		inferDate: async ({ message, currentDateStr }: InferDateParams) => {
			const response = await openAIParse({
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
			return {
				forDate: response.response.data.date as string &
					BRAND<"dateFormat=yyyy-MM-dd HH:mm:ss">,
				_usage: formatUsage({
					type: "openai",
					data: response.usage,
					title: "Infer Date",
				}),
			};
		},
	};
	if (!overrides) {
		return container satisfies Container as T;
	}
	return overrides(container);
};
