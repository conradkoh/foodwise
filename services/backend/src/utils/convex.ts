import * as convexZod from "convex-helpers/server/zod";
import type {
	FunctionReference,
	FunctionReturnType,
	OptionalRestArgs,
} from "convex/server";
export const zodToConvex = convexZod.zodToConvex;
export const zid = convexZod.zid;

/**
 * Extracts the argument type of a function reference
 */
export type FunctionArgs<FunctionRefAny> = FunctionRefAny extends
	| FunctionReference<"mutation" | "action", "internal" | "public">
	| FunctionReference<"query", "internal" | "public">
	? OptionalRestArgs<FunctionRefAny>
	: never;
/**
 * Utility type to ensure that additional properties are not allowed
 */
type Exact<T, Shape> = T extends Shape
	? Exclude<keyof T, keyof Shape> extends never
		? T
		: never
	: never;
//========================================
// Bind Mutation
//========================================

export type BoundMutation<
	Mutation extends FunctionReference<"mutation", "internal" | "public">,
> = (...args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>>;

/**
 * Converts a mutation function reference to a callable function
 * @param ctx
 * @param functionRef
 * @returns
 */
export const bindMutation = <
	Mutation extends FunctionReference<"mutation", "internal" | "public">,
>(
	ctx: {
		runMutation: (
			ref: Mutation,
			...args: OptionalRestArgs<Mutation>
		) => Promise<FunctionReturnType<Mutation>>;
	},
	functionRef: Mutation,
) => {
	return async (...args: OptionalRestArgs<Mutation>) =>
		await ctx.runMutation(functionRef, ...args);
};
//========================================
// Bind Query
//========================================
export type BoundQuery<
	Query extends FunctionReference<"query", "internal" | "public">,
> = (...args: FunctionArgs<Query>) => Promise<FunctionReturnType<Query>>;

/**
 * Converts a query function reference to a callable function
 * @param ctx
 * @param functionRef
 * @returns
 */
export const bindQuery = <
	Query extends FunctionReference<"query", "internal" | "public">,
>(
	ctx: {
		runQuery: (
			ref: Query,
			...args: OptionalRestArgs<Query>
		) => Promise<FunctionReturnType<Query>>;
	},
	functionRef: Query,
) => {
	return async (...args: OptionalRestArgs<Query>) =>
		await ctx.runQuery(functionRef, ...args);
};
