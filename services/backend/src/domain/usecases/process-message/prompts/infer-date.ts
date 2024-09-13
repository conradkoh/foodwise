import { type BRAND, z } from "zod";

type InferDateParams = {
	currentDateStr: string & BRAND<"dateFormat=dd MMM yyyy HH:mm & tz=user">;
	message: string;
};

export const INFER_DATE_PROMPT = (p: InferDateParams) => {
	return `
## Goal
Infer the date from the user's message.
Date Format: YYYY-MM-DD HH:mm:ss

## Input

### Case: No date and time
Assume the current date and time.

### Case: Date only
Infer the time from the user's message.

### Case: Time Only
If the time is earlier than the current time, it means it is for the day before.
If the time is equal or later than the current time, it means it is for the current day.

## Input
The current date is ${p.currentDateStr}.

### User's Message
${p.message}

## Output:

`.trim();
};
export const inferDateReturn_zodSchema = z.object({
	date: z.string().describe("The date in YYYY-MM-DD HH:mm:ss format"),
});
