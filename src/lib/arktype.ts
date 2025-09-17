import { type Type, type } from 'arktype'
import { deposits, type goods, goods as goodsCatalog, modules, terrain } from '$assets/game-content'
import type { ScriptExecution } from './game/npcs/scripts'

export type TerrainType = keyof typeof terrain
export type GoodType = keyof typeof goods
export type DepositType = keyof typeof deposits
export type ModuleType = keyof typeof modules
export const GoodType = type.enumerated(...Object.keys(goodsCatalog))
export const TerrainType = type.enumerated(...Object.keys(terrain))
export const DepositType = type.enumerated(...Object.keys(deposits))
export const ModuleType = type.enumerated(...Object.keys(modules))

// Decorator for validating multiple arguments with individual schemas
export type ArkDef = Parameters<typeof type>[0]

function decorator(validate: (args: any[]) => any) {
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		const originalMethod = descriptor.value
		descriptor.value = function (...args: any[]) {
			const validationResult = validate(args)
			if (validationResult instanceof type.errors) {
				throw new Error(`Validation failed for ${propertyKey}: ${validationResult.summary}`)
			}
			return originalMethod.apply(this, args)
		}
		return descriptor
	}
}

export function contract<Args extends any[]>(...schemasInput: Args) {
	// @ts-expect-error: no proper ArkDef
	return decorator(type(schemasInput))
}

export function overloadContract<Args extends any[][]>(...schemasInput: Args) {
	// @ts-expect-error: no proper ArkDef
	return decorator(type.or(...schemasInput))
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
