import { CALORIE_SUMMARY_TEXT } from "@/domain/usecases/process-message/messages/fragments/calorie-summary";

export const PROGRESS_UPDATE_TEXT = (p: ProgressUpdateParams) => {
	return `
<b>Your progress for ${p.date} (${p.dayOfWeek})</b>
 - ${CALORIE_SUMMARY_TEXT({
		caloriesIn: p.caloriesIn,
		caloriesOut: p.caloriesOut,
 })},
 )}
`.trim();
};

type ProgressUpdateParams = {
	date: string;
	dayOfWeek: string;
	caloriesIn: { value: number; units: string } | undefined;
	caloriesOut: { value: number; units: string } | undefined;
};
