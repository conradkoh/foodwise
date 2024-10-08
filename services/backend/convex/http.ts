import type { MessageUsageMetric } from "@/domain/entities/message";
import { processMessage } from "@/domain/usecases/process-message";
import { bindMutation, bindQuery } from "@/utils/convex";
import { parseTelegramPayload, sendMessage } from "@/utils/telegram";
import { httpRouter } from "convex/server";
import { DateTime } from "luxon";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { BRAND } from "zod";
import { createContainer } from "@/infra/container";

const http = httpRouter();

http.route({
	path: "/onMessage",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		try {
			const message = parseTelegramPayload(await req.json());
			const chatId = message.message?.chat.id;
			const userId = message.message?.from.id;
			//validation
			if (!chatId) {
				console.error("No chat id found", message);
				return new Response(null, { status: 200 });
			}
			if (!userId) {
				console.error("No user id found", message);
				return new Response(null, { status: 200 });
			}
			if (!message.message?.text) {
				console.error("No message text found", message);
				return new Response(null, { status: 200 });
			}
			try {
				// try to get the user id from the database
				let user = await ctx.runQuery(internal.user._getTelegramUser, {
					telegramUserId: userId,
				});

				const userTz = user?.timezone || "Asia/Singapore";
				const format = "yyyy-MM-dd HH:mm:ss" as const;
				const currentDateStr = DateTime.now()
					.setZone(userTz)
					.toFormat(format) as string &
					BRAND<`dateFormat=${typeof format} & tz=user`>;

				// create user if not found
				if (!user) {
					user = await ctx.runMutation(internal.user._createUser, {
						type: "telegram",
						telegram: {
							userId: userId,
							firstName: message.message?.from.first_name,
							lastName: message.message?.from.last_name,
							username: message.message?.from.username,
						},
					});
				}

				let response = {
					isValid: false,
					intermediates: null as any | null,
					value: "Failed to process message",
					additionalMessages: [] as string[],
				};
				let usageMetrics: MessageUsageMetric[] | undefined = undefined;
				const fetchedData: { name: string; input: any; output: any }[] = [];
				try {
					//setup
					const container = createContainer(ctx, (container) => ({
						...container,
						getUserTimezone: async () => user.timezone,
						getLastNDaysSummary: async (args) => {
							const result = await container.getLastNDaysSummary(args);
							fetchedData.push({
								name: "getLastNDaysSummary",
								input: args,
								output: result,
							});
							return result;
						},
					}));
					//process the message
					const agentResponse = await processMessage(container)({
						userId: user._id,
						inputText: message.message?.text,
						userTz,
						currentDateStr,
					});
					// update usage metrics
					usageMetrics = [...agentResponse.usageMetrics];
					// update response
					switch (agentResponse.isError) {
						case true: {
							response = {
								isValid: false,
								value: "Failed to process message",
								intermediates: agentResponse.intermediates,
								additionalMessages: agentResponse.additionalMessages,
							};
							break;
						}
						case false: {
							response = {
								isValid: true,
								value: agentResponse.message,
								intermediates: agentResponse.intermediates,
								additionalMessages: agentResponse.additionalMessages,
							};
							break;
						}
					}
				} catch (error) {
					console.error("failed to process message.", error);
					response = {
						isValid: false,
						value: "Failed to process message",
						intermediates: null as any | null,
						additionalMessages: [] as string[],
					};
				}

				// store the log of the user's message
				try {
					await ctx.runMutation(internal.message._write, {
						userId: user?._id,
						source: "telegram",
						status: response.isValid ? "processed" : "failed",
						rawPayload: message,
						intermediates: response.intermediates,
						fetchedData,
						response: response.value,
						usageMetrics,
						totalCostEstimated: usageMetrics?.reduce(
							(state, metric) => {
								// aggregate by currency
								let stateForCurrency: { currency: "USD"; value: number } =
									state.index[metric.openAI.cost.currency];

								// init state for currency if not available
								if (!stateForCurrency) {
									const val = {
										currency: metric.openAI.cost.currency,
										value: 0,
									};
									state.index[metric.openAI.cost.currency] = val; //set in index
									state.result.push(val);
									stateForCurrency = val;
								}
								// start processing kinds metrics
								switch (metric.type) {
									case "openai": {
										// increment total
										stateForCurrency.value += metric.openAI.cost.total;
										break;
									}
									default: {
										// exhaustive switch for type
										const _: never = metric.type;
									}
								}
								return state;
							},
							{
								index: {} as Record<"USD", { currency: "USD"; value: number }>,
								result: [] as { currency: "USD"; value: number }[],
							},
						).result,
					});
				} catch (error) {
					console.error("failed to write message to db", error);
				}

				//Send a message to the user
				await sendMessage(ctx, { chatId }, async (tg) => {
					const responseSegments = [response.value];
					if (response.additionalMessages.length > 0) {
						responseSegments.push("\n------");
						responseSegments.push(response.additionalMessages.join("\n\n"));
					}
					return [tg.text(responseSegments.join("\n")).parseMode("HTML")];
				});
			} catch (error) {
				console.error("failed to process message.", error);
			}
			return new Response(null, { status: 200 });
		} catch (error) {
			console.error("uncaught exception in http onMessage handler:", error);
			return new Response(JSON.stringify(error), { status: 500 });
		}
	}),
});

export default http;
