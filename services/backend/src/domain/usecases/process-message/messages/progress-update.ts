import { formatDeficitSurplus } from "@/domain/usecases/process-message/messages/fragments/deficit";

export const PROGRESS_UPDATE_TEXT = (p: ProgressUpdateParams) => {
	return `
<b>Your progress for ${p.date} (${p.dayOfWeek})</b>
 - 🍔 In: ${Math.round(p.caloriesIn)} kcal, 🔥 Out: ${Math.round(p.caloriesOut)} kcal, ${formatDeficitSurplus(
		{
			deficit: {
				value: p.caloriesOut - p.caloriesIn,
				units: "kcal",
			},
		},
 )}
`.trim();
};

type ProgressUpdateParams = {
	date: string;
	dayOfWeek: string;
	caloriesIn: number;
	caloriesOut: number;
};
