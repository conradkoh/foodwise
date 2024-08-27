import { OpenAIModel } from "@/utils/openai/_models";
import { getUsage } from "@/utils/openai/_usage";
import OpenAI from "openai";
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
}) => {
	const client = new OpenAI();
	const schema = z.object({
		data: p.schema.zod,
	});
	const chatCompletion = await client.chat.completions.create({
		messages: [
			{ role: "system", content: p.systemPrompt },
			{ role: "user", content: p.text },
		],
		model: OpenAIModel.GPT_4o,
		temperature: 0,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: p.schema.name,
				strict: true,
				schema: zodToJsonSchema(schema),
			},
		},
	});

	// parse the response
	const contentRaw = chatCompletion.choices[0].message.content;
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

	const usage = getUsage(OpenAIModel.GPT_4o, chatCompletion);
	return {
		response: res,
		usage,
	};
};
