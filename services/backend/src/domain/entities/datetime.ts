import { DateTime } from "luxon";

/**
 * Filters a list of records for a given category
 * @param rec
 * @param category
 * @param tz
 * @returns
 */
export function filterByCategory<RecordType extends { timestamp: number }>(
	rec: RecordType[],
	category: "morning" | "evening",
	tz: string,
) {
	const filteredRecords = rec.filter((record) => {
		const date = DateTime.fromMillis(record.timestamp).setZone(tz);
		const hour = date.get("hour");
		if (hour >= 3 && hour < 15) {
			return category === "morning";
		}
		if (hour >= 15 || (hour >= 0 && hour < 3)) {
			return category === "evening";
		}
		return true;
	});
	return filteredRecords;
}
