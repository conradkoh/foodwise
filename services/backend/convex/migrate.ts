import { internalMutation } from 'convex/_generated/server';

export const migrate = internalMutation({
  args: {},
  handler: async (ctx) => {
    // set all userActivity.caloriesBurned.min and max to -1 for historical values
    const records = await ctx.db.query('userActivity').collect();
    for (const record of records) {
      await ctx.db.patch(record._id, {
        caloriesBurned: {
          ...record.caloriesBurned,
          min: -1,
          max: -1,
        },
      });
    }
  },
});
