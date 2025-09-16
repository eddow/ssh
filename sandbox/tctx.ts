const subject = Symbol('subject')

class tCls {
	tile: number
	doSth(x: number) {
		return `${x}`
	}
}

function proto<
	Class extends abstract new () => object,
	Proto extends object
>(
	concept: Class,
	proto?: Proto
): InstanceType<Class> & Proto {
	return Object.create(proto ?? null,
		Object.fromEntries(Object.entries(
			Object.getOwnPropertyDescriptors(concept.prototype)
		).filter(([k]) => k !== 'constructor'))
	) as InstanceType<Class> & Proto
}

type HasSubject<Subject> = {
	[subject]: Subject
}

type SubFunctions<T> = { [k: string]: (this: T, ...args: any[]) => any }


const tCtx = proto(class TCls {
	declare [subject]: tCls
	throwSth(x: number) { return this[subject].doSth(x) }
	get tile() { return this[subject] }
})