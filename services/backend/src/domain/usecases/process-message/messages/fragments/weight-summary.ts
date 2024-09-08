import type { DayOfWeekFormattedString } from "@/domain/usecases/process-message/messages/format/date";

export const WEIGHT_SUMMARY_TEXT = (p: {
	dayOfWeekStr?: DayOfWeekFormattedString;
	firstMorningWeight?: { value: number; units: string };
	lastEveningWeight?: { value: number; units: string };
}) => {
	const prefix = p.dayOfWeekStr ? `[${p.dayOfWeekStr}] ` : "";
	const msg = `${prefix}☀️ ${formatWeight(p.firstMorningWeight)} | 🌙 ${formatWeight(p.lastEveningWeight)}`;
	return msg;
};

export function formatWeight(weight?: { value: number; units: string }) {
	if (!weight) return "No data";
	return `<code>${Number.parseFloat(weight.value.toFixed(2))} ${weight.units}</code>`;
}

export function formatWeightDifference(p: {
	earlier?: {
		value: number;
		units: string;
	};
	later?: {
		value: number;
		units: string;
	};
	text: {
		earlier: string;
		later: string;
	};
}) {
	// both earlier and later are provided
	if (p.earlier && p.later) {
		if (p.earlier.units !== p.later.units) {
			throw new Error("Weight units do not match");
		}
		const weightLost = {
			value: p.earlier.value - p.later.value,
			units: p.earlier.units,
		};

		const suffix = (weightLost.value || 0) >= 0 ? "lost" : "gained";
		const symbol = (weightLost.value || 0) >= 0 ? "👍🏼" : "⚠️";
		return `${symbol} ${formatWeight({
			value: Math.abs(weightLost.value),
			units: weightLost.units,
		})} ${suffix} | ${formatWeight(p.earlier)} -> ${formatWeight(p.later)}`;
	}

	// only later is provided
	if (!p.earlier && p.later) {
		return `${p.text.later} @ ${formatWeight(p.later)}`;
	}
	// neither earlier nor later is provided
	else {
		return "No data";
	}
}
