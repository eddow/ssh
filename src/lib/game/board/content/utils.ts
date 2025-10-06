import type { GoodType } from '$lib/arktype'

type Ctor<T extends object = any> = abstract new (...args: any[]) => T

export function GcClass<BaseCtor extends Ctor<any>>(
	Base: (def: any) => BaseCtor,
	name: string,
	def: any,
): BaseCtor {
	class Sub extends (Base(def) as Ctor) {
		static resourceName = name
	}
	Object.defineProperties(Sub, { name: { value: `${Base.name}<${name}>` } })
	Object.assign(Sub.prototype, def)
	// Expose a helpful debug label for instances
	try {
		Object.defineProperties(Sub.prototype, {
			[Symbol.toStringTag]: { value: `${Base.name}<${name}>`, configurable: true },
			[Symbol.for('nodejs.util.inspect.custom')]: {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				value(this: unknown, _depth?: number, _options?: unknown, _inspect?: unknown) {
					return `${Base.name}<${name}>`
				},
				configurable: true,
			},
		})
	} catch {
		// Best-effort; ignore environments where symbols are not configurable
	}
	return Sub as unknown as BaseCtor
}

export function GcClasses<
	BaseCtor extends Ctor<any>,
	Entries extends Record<string, any> = Record<string, any>,
>(Base: (def: any) => BaseCtor, entries: Entries) {
	return Object.fromEntries(
		Object.entries(entries).map(([name, def]) => [name, GcClass(Base, name, def)]),
	) as { [K in keyof Entries]: BaseCtor & Entries[K] }
}

/**
 * Only used for typing purposes, not for instantiation
 * @returns
 */
export function GcClassed<T extends object>() {
	return class {
		get name() {
			// @ts-expect-error
			return this.constructor.resourceName
		}
	} as new (
		...args: any[]
	) => T & { readonly name: string }
}

export function multiplyGoodsQty(record: Partial<Record<GoodType, number>>, multiplier: number) {
	return Object.fromEntries(
		Object.entries(record).map(([goodType, quantity]) => [goodType, quantity * multiplier]),
	)
}
