import { TelegramMessageBuilder } from "@/utils/telegram/classes/TelegramMessageBuilder";
import { telegramMessageOutgoingConvexSchema } from "@/utils/telegram/types";
import { internal } from "convex/_generated/api";
import { type ActionCtx, internalAction } from "convex/_generated/server";

/**
 * Register webhook with telegram.
 * Expose this function in convex/telegram.ts
 */
export const registerWebhookAction = internalAction({
	args: {},
	handler: async () => {
		const url = `${process.env.CONVEX_SITE_URL}/onMessage?token=${process.env.TELEGRAM_WEBHOOK_SECRET}`;
		const response = await fetch(
			"https://api.telegram.org/bot" +
				process.env.TELEGRAM_BOT_TOKEN +
				"/setWebhook",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					url: url,
				}),
			},
		);
		if (response.status !== 200) {
			throw new Error("Failed to register webhook");
		}
	},
});

/**
 * Send message to telegram.
 * Expose this function in convex/telegram.ts
 */
export const sendMessageAction = internalAction({
	args: telegramMessageOutgoingConvexSchema,
	handler: async (ctx, args) => {
		const response = await fetch(
			"https://api.telegram.org/bot" +
				process.env.TELEGRAM_BOT_TOKEN +
				"/sendMessage",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(args),
			},
		);
		if (response.status !== 200) {
			console.error("failed to send telegram message:", {
				input: args,
				request: {
					body: args,
				},
				response: {
					res: response,
					body: await response.json(),
				},
			});
			throw new Error("Failed to send message");
		}
	},
});

/**
 * Sends a message to telegram
 * @param handler
 */
export const sendMessage = async (
	ctx: ActionCtx,
	to: {
		chatId: number;
	},
	handler: (
		tg: TelegramMessageBuilder,
	) =>
		| Promise<[message: TelegramMessageBuilder]>
		| [message: TelegramMessageBuilder],
) => {
	const t = new TelegramMessageBuilder();
	t.chatId(to.chatId);
	const [builder] = await handler(t);
	const message = builder.build();
	await ctx.runAction(internal.telegram.sendMessage, message);
};

//export all types from the telegram helpers
export * from "./types";
