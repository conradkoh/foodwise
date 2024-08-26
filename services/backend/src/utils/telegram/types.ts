import { zodToConvex } from "@/utils/convex";
import { z } from "zod";
// -----------------------------
// Webhook Payload
// -----------------------------
//Types
export type WebhookPayload = z.infer<typeof telegramPayloadZodSchema>;
export function parseTelegramPayload(payload: any): WebhookPayload {
	return telegramPayloadZodSchema.parse(payload);
}

//Zod
const telegramPayloadZodSchema = z.object({
	update_id: z.number(),
	message: z
		.object({
			message_id: z.number(),
			from: z.object({
				id: z.number(),
				is_bot: z.boolean(),
				first_name: z.string(),
				last_name: z.string().optional(), // Optional
				username: z.string().optional(), // Optional
				language_code: z.string().optional(), // Optional
			}),
			chat: z.object({
				id: z.number(),
				first_name: z.string().optional(), // Optional
				last_name: z.string().optional(), // Optional
				username: z.string().optional(), // Optional
				type: z.string(),
			}),
			date: z.number(),
			text: z.string().optional(), // Optional
			entities: z
				.array(
					z.object({
						offset: z.number(),
						length: z.number(),
						type: z.string(),
					}),
				)
				.optional(), // Optional
		})
		.optional(), // Optional because other types of updates can exist
});

//Convex
export const telegramPayloadConvexSchema = zodToConvex(
	telegramPayloadZodSchema,
);

// -----------------------------
// Telegram Message
// -----------------------------

// Zod schema for TelegramMessageOutgoing
const telegramMessageOutgoingZodSchema = z.object({
	chat_id: z.union([z.number(), z.string()]),
	message_thread_id: z.number().optional(),
	text: z.string(),
	parse_mode: z.enum(["MarkdownV2", "HTML", "Markdown"]).optional(),
	entities: z
		.array(
			z.object({
				type: z.string(),
				offset: z.number(),
				length: z.number(),
				url: z.string().optional(),
				user: z.object({}).optional(),
				language: z.string().optional(),
				custom_emoji_id: z.string().optional(),
			}),
		)
		.optional(),
	disable_web_page_preview: z.boolean().optional(),
	disable_notification: z.boolean().optional(),
	protect_content: z.boolean().optional(),
	reply_to_message_id: z.number().optional(),
	allow_sending_without_reply: z.boolean().optional(),
	reply_markup: z
		.object({
			inline_keyboard: z.array(
				z.array(
					z.object({
						text: z.string(),
						url: z.string().optional(),
						callback_data: z.string().optional(),
						web_app: z.object({ url: z.string() }).optional(),
						login_url: z
							.object({
								url: z.string(),
								forward_text: z.string().optional(),
								bot_username: z.string().optional(),
								request_write_access: z.boolean().optional(),
							})
							.optional(),
						switch_inline_query: z.string().optional(),
						switch_inline_query_current_chat: z.string().optional(),
						callback_game: z.object({}).optional(),
						pay: z.boolean().optional(),
					}),
				),
			),
		})
		.optional(),
});

// Type inference from the Zod schema
export type TelegramMessageOutgoing = z.infer<
	typeof telegramMessageOutgoingZodSchema
>;

// Convex schema
export const telegramMessageOutgoingConvexSchema = zodToConvex(
	telegramMessageOutgoingZodSchema,
);
