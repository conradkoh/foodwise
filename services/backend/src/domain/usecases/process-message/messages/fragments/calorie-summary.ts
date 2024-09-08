import { formatDeficitSurplus } from "@/domain/usecases/process-message/messages/fragments/deficit";

export const CALORIE_SUMMARY_TEXT = (p: {
	caloriesIn: { value: number; units: string } | undefined;
	caloriesOut: { value: number; units: string } | undefined;
}) => {
	if (
		p.caloriesIn &&
		p.caloriesOut &&
		p.caloriesIn.units !== p.caloriesOut.units
	) {
		return `In units (${p.caloriesIn.units}) and out units (${p.caloriesOut.units}) do not match`;
	}
	const msg = `
🍔 In: ${formatCalories(p.caloriesIn)}, 🔥 Out: ${formatCalories(p.caloriesOut)}, ${formatDeficitSurplus(
		{
			mode: "by_calories",
			caloriesIn: p.caloriesIn,
			caloriesOut: p.caloriesOut,
		},
	)}`.trim();
	return msg;
};

export function formatCalories(calories?: { value: number; units: string }) {
	if (!calories) return "No data";
	return `<code>${Math.round(calories.value)} ${calories.units}</code>`;
}
