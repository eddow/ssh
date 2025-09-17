type Ctor<T extends object = any> = abstract new (...args: any[]) => T

export function GcClass<BaseCtor extends Ctor<any>, TDef extends object>(
	Base: BaseCtor,
	name: string,
	def: TDef,
): BaseCtor {
	class Sub extends (Base as Ctor) {}
	Object.defineProperties(Sub, { name: { value: `${Base.name}<${name}>` } })
	Object.assign((Sub as any).prototype, def)
	return Sub as unknown as BaseCtor
}

export function GcClasses<
	BaseCtor extends Ctor<any>,
	Entries extends Record<string, any> = Record<string, any>,
>(Base: BaseCtor, entries: Entries) {
	return Object.fromEntries(
		Object.entries(entries).map(([name, def]) => [name, GcClass(Base, name, def)]),
	) as { [K in keyof Entries]: BaseCtor }
}

export function NoConstructor<T extends object>() {
	return class {} as new () => T
}
