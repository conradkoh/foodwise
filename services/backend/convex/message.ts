import { message_convexSchema } from "@/domain/entities/message";
import { internalMutation } from "./_generated/server";
//writes a message to the database
export const _write = internalMutation({
	args: message_convexSchema,
	handler: async (ctx, args) => {
		await ctx.db.insert("messages", args);
	},
});
