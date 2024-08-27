export const PROGRESS_UPDATE_TEXT = (p: ProgressUpdateParams) => {
	const deficit = p.caloriesOut - p.caloriesIn;
	const deficitSymbol = deficit > 0 ? "👍🏼" : "‼️";
	return `
<b>Your progress for ${p.date}</b>
 - 🍔 In: ${Math.round(p.caloriesIn)} kcal, 🔥 Out: ${Math.round(p.caloriesOut)} kcal, ${deficitSymbol} Deficit: ${Math.round(deficit)} kcal
`.trim();
};

type ProgressUpdateParams = {
	date: string;
	caloriesIn: number;
	caloriesOut: number;
};
