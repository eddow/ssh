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
	Object.assign((Sub as any).prototype, def)
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
	) => T
}
