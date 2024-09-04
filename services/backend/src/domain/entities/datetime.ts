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
	category: "morning" | "afternoon" | "evening",
	tz: string,
) {
	const filteredRecords = rec.filter((record) => {
		const date = DateTime.fromMillis(record.timestamp).setZone(tz);
		const hour = date.get("hour");
		if (hour >= 0 && hour < 8) {
			return category === "morning";
		}
		if (hour >= 8 && hour < 16) {
			return category === "afternoon";
		}
		if (hour >= 16 && hour < 24) {
			return category === "evening";
		}
		return true;
	});
	return filteredRecords;
}
