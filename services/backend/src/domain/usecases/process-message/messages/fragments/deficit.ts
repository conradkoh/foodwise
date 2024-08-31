interface DeficitSurplusParams {
	deficit?: {
		value: number;
		units: string;
	};
}

/**
 * Formats the deficit or surplus text
 * Example:
 *    - Deficit: 👍🏼 1000 kcal
 *    - Surplus: ⚠️ 500 kcal
 * @param params
 * @returns
 */
export const formatDeficitSurplus = (params: DeficitSurplusParams) => {
	const deficit = params.deficit;
	let deficitSurplusText = "Deficit";
	if (deficit && deficit.value < 0) {
		deficitSurplusText = "Surplus";
	}
	let detail = "No data recorded";
	if (deficit) {
		const positiveVal = Math.abs(deficit.value);
		// prettify value to remove redundant trailing zero decimals
		let prettyVal = positiveVal.toFixed(2);
		if (prettyVal.endsWith(".00")) {
			prettyVal = prettyVal.slice(0, -3);
		}
		const deficitSymbol = deficit.value > 0 ? "👍🏼" : "⚠️";

		// format the details
		detail = `${deficitSymbol} ${prettyVal} ${deficit.units}`;
	}
	return `${deficitSurplusText}: ${detail}`;
};
