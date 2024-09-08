import { internalMutation, type MutationCtx } from "convex/_generated/server";

export const migrate = internalMutation({
	args: {},
	handler: async (ctx) => {
		const migrateMealsV2_result = await migrateMealsV2(ctx);
		const recomputeTotalCalories_result = await recomputeTotalCalories(ctx);
		console.log({
			migrateMealsV2_result,
			recomputeTotalCalories_result,
		});
		return {
			migrateMealsV2_result,
			recomputeTotalCalories_result,
		};
	},
});

/**
 * Convert the items from v1 to v2 schema
 * @param ctx
 */
async function migrateMealsV2(ctx: MutationCtx) {
	// migrate all meals to schema version v2
	const meals = await ctx.db.query("userMeal").collect();
	const actions: any[] = [];
	for (const meal of meals) {
		if (meal.schemaVersion !== "v2") {
			const newItems = meal.items.map((item) => {
				const legacyCalories = item.estimatedCalories;
				const legacyQuantity = item.quantity;
				return {
					name: item.name,
					estimatedCaloriesPerPortion: {
						units: legacyCalories.units,
						min: legacyCalories.min / legacyQuantity,
						max: legacyCalories.max / legacyQuantity,
					},
					numPortions: item.quantity,
				};
			});
			actions.push({
				before: meal,
				after: {
					schemaVersion: "v2",
					items: newItems,
				},
			});

			// recompute the total calories
			await ctx.db.patch(meal._id, {
				schemaVersion: "v2",
				items: newItems,
			});
		}
	}
	return {
		actions,
		recordsUpdated: actions.length,
	};
}

/**
 * Recompute all the total calories for the user meals
 */
async function recomputeTotalCalories(ctx: MutationCtx) {
	const meals = await ctx.db.query("userMeal").collect();
	const actions: any[] = [];
	for (const meal of meals) {
		if (meal.schemaVersion === "v2") {
			const totalCalories = meal.items.reduce(
				(state: { kcal: number }, item) => {
					const average =
						((item.estimatedCaloriesPerPortion.min +
							item.estimatedCaloriesPerPortion.max) *
							item.numPortions) /
						2;
					state.kcal += average;
					return state;
				},
				{ kcal: 0 },
			);
			actions.push({
				before: meal,
				after: {
					totalCalories: {
						value: totalCalories.kcal,
						units: "kcal",
					},
				},
			});
			await ctx.db.patch(meal._id, {
				totalCalories: {
					value: totalCalories.kcal,
					units: "kcal",
				},
			});
		}
	}
	return {
		actions,
		recordsUpdated: actions.length,
	};
}
