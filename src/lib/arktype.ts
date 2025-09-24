import { type Type, type } from 'arktype'
import { alveoli, deposits, type goods, goods as goodsCatalog, terrain } from '$assets/game-content'
import type { ScriptExecution } from './game/npcs/scripts'

export type TerrainType = keyof typeof terrain
export type GoodType = keyof typeof goods
export type DepositType = keyof typeof deposits
export type AlveolusType = keyof typeof alveoli
export const GoodType = type.enumerated(...Object.keys(goodsCatalog))
export const TerrainType = type.enumerated(...Object.keys(terrain))
export const DepositType = type.enumerated(...Object.keys(deposits))
export const AlveolusType = type.enumerated(...Object.keys(alveoli))

// Decorator for validating multiple arguments with individual schemas
export type ArkDef = Parameters<typeof type>[0]

const contractRegistry = new WeakSet<(args: any[]) => any>()
export function isContract(validate: (args: any[]) => any) {
	return contractRegistry.has(validate)
}
export function registerContract(validate: (args: any[]) => any) {
	contractRegistry.add(validate)
	return validate
}

function contractDecorator(validate: (args: any[]) => any) {
	return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		const originalMethod = descriptor.value
		descriptor.value = registerContract(function contractValidator(this: any, ...args: any[]) {
			const validationResult = validate(args)
			if (validationResult instanceof type.errors) {
				throw new Error(`Validation failed for ${propertyKey}: ${validationResult.summary}`)
			}
			return originalMethod.apply(this, args)
		})
		return descriptor
	}
}

export function contract<Args extends any[]>(...schemasInput: Args) {
	// @ts-expect-error: no proper ArkDef
	return contractDecorator(type(schemasInput))
}

export function overloadContract<Args extends any[][]>(...schemasInput: Args) {
	// @ts-expect-error: no proper ArkDef
	return contractDecorator(type.or(...schemasInput))
}

// ContractType turns a declarative contract object into callable signatures
export type ContractType<T> = {
	[K in keyof T]: T[K] extends readonly (Type | ArkDef)[]
		? (...args: type.infer<T[K]>) => ScriptExecution
		: T[K] extends object
			? ContractType<T[K]>
			: never
}

export type Contract = readonly (Type | ArkDef)[] | { [K: string]: Contract }
