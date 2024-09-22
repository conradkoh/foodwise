import { OpenAIModel } from "@/utils/openai/_models";
import {
	aggregateUsage,
	getUsage,
	type OpenAICompletionUtilization,
} from "@/utils/openai/_usage";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
// T if undefined, then it will be never. used to make sure that the schema is not undefined

export const openAIParse = async <T extends z.ZodType>(p: {
	systemPrompt: string;
	text: string; //the input text to be sent
	schema: {
		name: string; //The name of the schema that gives context to the data that the response should contain
		zod: T;
	};
	options?: {
		overrideMessages?: Array<ChatCompletionMessageParam>;
		refineTimes?: number;
	};
}): Promise<{
	response: z.infer<typeof schema>;
	usage: OpenAICompletionUtilization;
}> => {
	const client = new OpenAI();
	const schema = z.object({
		data: p.schema.zod,
	});
	const messages = p.options?.overrideMessages ?? [
		{ role: "system", content: p.systemPrompt },
		{ role: "user", content: p.text },
	];
	const chatCompletion = await client.chat.completions.create({
		messages,
		model: OpenAIModel.GPT_4o_mini,
		temperature: 0,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: p.schema.name,
				strict: true,

				//NOTE: OpenAI does not support optional properties except via union types
				// https://platform.openai.com/docs/guides/structured-outputs/supported-schemas
				schema: zodToJsonSchema(schema),
			},
		},
	});

	// parse the response
	const contentRaw = chatCompletion.choices[0]?.message?.content;
	if (!contentRaw) throw new Error("Null response from OpenAI");
	let res: z.infer<typeof schema> | undefined;
	try {
		res = schema.parse(JSON.parse(contentRaw));
	} catch (err) {
		console.error(
			"invalid payload:",
			JSON.stringify(JSON.parse(contentRaw), null, 2),
		);
		throw new Error("OpenAI return a response with an invalid format.");
	}

	let usage = getUsage(OpenAIModel.GPT_4o_mini, chatCompletion);

	//start refining
	if (p.options?.refineTimes !== undefined) {
		for (let i = 0; i < p.options.refineTimes; i++) {
			const previousResponse: string = contentRaw;
			const refined = await openAIParse({
				systemPrompt: p.systemPrompt,
				text: p.text,
				options: {
					overrideMessages: [
						...messages,
						{
							role: "assistant",
							content: previousResponse,
						},
						{
							role: "user",
							content:
								"verify your response. improve the quality of the data, and accuracy of the response",
						},
					],
				},
				schema: p.schema,
			});

			// update output
			res = refined.response;
			usage = aggregateUsage([usage, refined.usage]);
		}
	}
	return {
		response: res,
		usage,
	};
};
