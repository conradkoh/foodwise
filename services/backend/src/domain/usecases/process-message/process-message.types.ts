import type { MessageUsageMetric } from "@/domain/entities/message";
import type { Stage1Output } from "@/domain/usecases/process-message/schemas/stage_1";
import type { Stage2Output } from "@/domain/usecases/process-message/schemas/stage_2";
import type { Container } from "@/infra/container";
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
	currentDateStr: string & BRAND<"dateFormat=dd MMM yyyy HH:mm & tz=user">;
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

export type ProcessMessageDeps = Pick<
	Container,
	| "setUserAge"
	| "setUserGender"
	| "setUserHeight"
	| "setUserTimezone"
	| "recordUserWeight"
	| "recordUserMealAndCalories"
	| "recordActivityAndBurn"
	| "getLastNDaysSummary"
	| "getUserLatestState"
> & {
	getUserTimezone: () => Promise<string | undefined>;
};
