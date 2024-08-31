import type { MessageUsageMetric } from "@/domain/entities/message";
import type { Stage1Output } from "@/domain/usecases/process-message/schemas/stage_1";
import type { Stage2Output } from "@/domain/usecases/process-message/schemas/stage_2";
import type { BoundMutation, BoundQuery } from "@/utils/convex";
import type { internal } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { BRAND } from "zod";

export type ProcessMessageFunc = (
	deps: ProcessMessageDeps,
) => (params: ProcessMessageParams) => Promise<ProcessMessageResult>;

// =========================================
// Process Message Params
// =========================================

export type ProcessMessageParams = {
	userId: Id<"user">;
	inputText: string;
	userTz: string;
	currentDateStr: string & BRAND<"dateFormat=dd MMM yyyy HH:mm">;
};
// =========================================
// Process Message Result
// =========================================
export type ProcessMessageResult = {
	isError: boolean;
	message: string;
	additionalMessages: string[];
	intermediates: {
		stage1Output?: Stage1Output;
		stage2Output?: Stage2Output;
	};
	actionsTaken: string[];
	usageMetrics: MessageUsageMetric[];
};

// =========================================
// Process Message Dependencies
// =========================================

export type ProcessMessageDeps = {
	recordUserWeight: BoundMutation<typeof internal.user._recordUserWeight>;
	recordUserMealAndCalories: BoundMutation<
		typeof internal.user._recordUserMealAndCalories
	>;
	recordActivityAndBurn: BoundMutation<
		typeof internal.user._recordActivityAndBurn
	>;
	getUserTimezone: () => Promise<string | undefined>;
	setUserTimezone: BoundMutation<typeof internal.user._setUserTimezone>;
	getLastNDaysSummary: BoundQuery<typeof internal.user._getLastNDaysSummary>;
	setUserGender: BoundMutation<typeof internal.user._setUserGender>;
	setUserAge: BoundMutation<typeof internal.user._setUserAge>;
	setUserHeight: BoundMutation<typeof internal.user._setUserHeight>;
	getUserLatestState: BoundQuery<typeof internal.user._getUser>;
};
