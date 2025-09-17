export const tileSize = 30
export const epsilon = 1e-6

export function objectMap<T extends Record<string, any>, R extends { [k in keyof T]: any }>(
	obj: T,
	fn: <K extends keyof T>(value: T[K], key: K) => R[K],
): Partial<R> {
	return Object.fromEntries(
		Object.entries(obj).map(([key, value]) => [key, fn(value, key)] as [keyof R, R[keyof R]]) as [
			keyof R,
			R[keyof R],
		][],
	) as Partial<R>
}

type ElementTypes<T extends readonly unknown[]> = {
	[K in keyof T]: T[K] extends readonly (infer U)[] ? U : T[K]
}

export function zip<T extends (readonly unknown[])[]>(...args: T): ElementTypes<T>[] {
	if (!args.length) return []
	const minLength = Math.min(...args.map((arr) => arr.length))
	const result: ElementTypes<T>[] = []

	for (let i = 0; i < minLength; i++) {
		const tuple = args.map((arr) => arr[i]) as ElementTypes<T>
		result.push(tuple)
	}

	return result
}

export function isInteger(value: number): boolean {
	return value - Math.floor(value) < epsilon
}
