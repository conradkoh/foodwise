import { DateTime } from "luxon";

/**
 * Get the end of the day for the given timestamp
 * @param ts Timestamp in milliseconds
 * @param tz Timezone
 * @returns
 */
export function endOfDay(ts: number, tz: string) {
	const dateTime = DateTime.fromMillis(ts, { zone: tz });
	return dateTime.setZone(tz).endOf("day").toMillis();
}

/**
 * Get the end of the current day
 * @param tz
 * @returns
 */
export function endOfCurrentDay(tz: string) {
	return endOfDay(DateTime.now().toMillis(), tz);
}
