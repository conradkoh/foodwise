import { internalMutation } from "convex/_generated/server";

export const migrate = internalMutation({
	args: {},
	handler: async (ctx) => {
		// set all quantities to 1 if not provided
		const meals = await ctx.db.query("userMeal").collect();
		for (const meal of meals) {
			if (!meal.items.some((item) => item.quantity)) {
				await ctx.db.patch(meal._id, {
					items: meal.items.map((item) => ({
						...item,
						quantity: 1,
					})),
				});
			}
		}
	},
});
