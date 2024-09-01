/**
 * Removes undefined from a type
 */
export type RemoveUndefined<T> = T extends undefined ? never : T;

/**
 * Ensures that the type T is exactly the same as the type Shape with no extra properties
 */
export type Exact<T, Shape> = T extends Shape
	? Exclude<keyof T, keyof Shape> extends never
		? T
		: never
	: never;
