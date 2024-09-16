import type { DateTime } from "luxon";
import type { BRAND } from "zod";

//===========================================
// Date Format: yyyy-MM-dd
//===========================================
export const YMD_DATE_FORMAT_BRAND = "dateFormat=yyyy-MM-dd" as const;
export type YMDDateFormattedString = string &
	BRAND<typeof YMD_DATE_FORMAT_BRAND>;
export const YMD_DATE_FORMAT = (date: DateTime): YMDDateFormattedString => {
	return date.toFormat("yyyy-MM-dd") as YMDDateFormattedString;
};
//===========================================

//===========================================
// Date Format: 3 Letter Weekday
//===========================================
export const DAY_OF_WEEK_FORMAT_BRAND = "dateFormat=DOW_ccc" as const;
export type DayOfWeekFormattedString = string &
	BRAND<typeof DAY_OF_WEEK_FORMAT_BRAND>;
export const DAY_OF_WEEK_FORMAT = (
	date: DateTime,
): DayOfWeekFormattedString => {
	return date.toFormat("ccc") as DayOfWeekFormattedString;
};
