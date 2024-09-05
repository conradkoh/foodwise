import { zid, zodToConvex } from "@/utils/convex";
import type { RemoveUndefined } from "@/utils/typescript";
import { z } from "zod";
//========================================
//User
//========================================

export type User = z.infer<typeof user_zodSchema>;

/**
 * Check if the user is ready to use the app
 * @param user
 * @returns
 */
export function isUserReady(
	user: Pick<User, "timezone" | "gender" | "yearOfBirth" | "height">,
) {
	return (
		!!user.timezone && !!user.gender && !!user.yearOfBirth && !!user.height
	);
}

/**
 * Get the Basal Metabolic Rate (BMR) for the user
 * @param user
 * @param opts
 * @returns
 */
export function getUserBMR(
	user: User,
	opts: { currentYear: number },
): {
	bmr: {
		value: number;
		units: "kcal";
	};
	assumptions: {
		gender: RemoveUndefined<Pick<User, "gender">["gender"]>;
		age: number;
		yearOfBirth: RemoveUndefined<Pick<User, "yearOfBirth">["yearOfBirth"]>;
		height: RemoveUndefined<Pick<User, "height">["height"]>;
		weight: RemoveUndefined<Pick<User, "weight">["weight"]>;
	};
} {
	const gender = user.gender || "male";
	const yearOfBirth = user.yearOfBirth || 2000;
	const age = opts.currentYear - yearOfBirth;
	const height = user.height || {
		value: 165,
		units: "cm",
	};
	const weight = user.weight || {
		value: 70,
		units: "kg",
	};
	const assumptions = {
		gender,
		age,
		yearOfBirth,
		height,
		weight,
	};

	// bmr calc unit validation
	if (weight.units !== "kg") {
		throw new Error("Weight units must be in kg");
	}
	if (height.units !== "cm") {
		throw new Error("Height units must be in cm");
	}

	if (gender === "male") {
		return {
			bmr: {
				value:
					88.362 + 13.397 * weight.value + 4.799 * height.value - 5.677 * age,
				units: "kcal",
			},
			assumptions,
		};
	}

	return {
		bmr: {
			value: 447.593 + 9.247 * weight.value + 3.098 * height.value - 4.33 * age,
			units: "kcal",
		},
		assumptions,
	};
}

// zod
const user_zodSchema = z.object({
	type: z.literal("telegram"),
	telegram: z.object({
		userId: z.number(),
		firstName: z.optional(z.string()),
		lastName: z.optional(z.string()),
		username: z.optional(z.string()),
	}),
	timezone: z.optional(z.string()),
	gender: z.optional(z.union([z.literal("male"), z.literal("female")])),
	yearOfBirth: z.optional(z.number().positive()),
	height: z.optional(
		z.object({
			value: z.number().positive(),
			units: z.literal("cm"),
		}),
	),
	weight: z.optional(
		z.object({
			value: z.number().positive(),
			units: z.literal("kg"),
		}),
	),
});

// convex
export const user_convexSchema = zodToConvex(user_zodSchema);

//========================================
//User Weight
//========================================
export type UserWeight = z.infer<typeof userWeight_zodSchema>;

const userWeight_zodSchema = z.object({
	userId: zid("user"),
	weight: z.object({
		value: z.number(),
		units: z.literal("kg"),
	}),
	timestamp: z.number(),
});

export const userWeight_convexSchema = zodToConvex(userWeight_zodSchema);

//========================================
//User Meal
//========================================
export type UserMeal = z.infer<typeof userMeal_zodSchema>;

const userMeal_zodSchema = z.object({
	userId: zid("user"),
	items: z.array(
		z.object({
			name: z.string(),
			estimatedCalories: z.object({
				value: z.number(),
				min: z.number(),
				max: z.number(),
				units: z.literal("kcal"),
			}),
			quantity: z.number(),
		}),
	),
	totalCalories: z.object({ value: z.number(), units: z.literal("kcal") }),
	timestamp: z.number(),
});

export const userMeal_convexSchema = zodToConvex(userMeal_zodSchema);

//========================================
//User Activity
//========================================
export type UserActivity = z.infer<typeof userActivity_zodSchema>;

const userActivity_zodSchema = z.object({
	userId: zid("user"),
	activity: z.string(),
	caloriesBurned: z.object({
		value: z.number(),
		min: z.number(),
		max: z.number(),
		units: z.literal("kcal"),
	}),
	timestamp: z.number(),
});

export const userActivity_convexSchema = zodToConvex(userActivity_zodSchema);
