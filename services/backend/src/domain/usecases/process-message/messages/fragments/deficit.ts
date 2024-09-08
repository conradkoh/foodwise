type DeficitSurplusParams =
	| {
			mode: "by_deficit";
			deficit?: {
				value: number;
				units: string;
			};
	  }
	| {
			mode: "by_calories";
			caloriesIn?: { value: number; units: string };
			caloriesOut?: { value: number; units: string };
	  };

/**
 * Formats the deficit or surplus text
 * Example:
 *    - 👍🏼 1000 kcal deficit
 *    - ⚠️ 500 kcal surplus
 * @param params
 * @returns
 */
export const formatDeficitSurplus = (params: DeficitSurplusParams) => {
	let deficit: { value: number; units: string } | undefined = undefined;
	switch (params.mode) {
		case "by_deficit": {
			deficit = params.deficit;
			break;
		}
		case "by_calories": {
			if (params.caloriesIn && params.caloriesOut) {
				deficit = {
					value: params.caloriesOut.value - params.caloriesIn.value,
					units: params.caloriesOut.units,
				};
			}
			break;
		}
		default: {
			throw new Error("Invalid mode");
		}
	}

	// start formatting
	let deficitSurplusText = "deficit";
	if (deficit && deficit.value < 0) {
		deficitSurplusText = "surplus";
	}
	if (deficit === undefined) {
		return "No data";
	}
	const positiveVal = Math.abs(deficit.value);
	// prettify value to remove redundant trailing zero decimals
	let prettyVal = "" + Number.parseFloat(positiveVal.toFixed(2));
	if (prettyVal.endsWith(".00")) {
		prettyVal = prettyVal.slice(0, -3);
	}
	const deficitSymbol = deficit.value > 0 ? "👍🏼" : "⚠️";

	// format the details
	return `${deficitSymbol} <code>${prettyVal} ${deficit.units}</code> ${deficitSurplusText}`;
};
