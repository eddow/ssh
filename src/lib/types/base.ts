import { scope, type } from 'arktype'
import { alveoli, deposits, goods as goodsCatalog, terrain } from '$assets/game-content'
import type { AllocationBase } from '$lib/game'
import type { TileContent } from '$lib/game/board'
import { type Positioned, positionScope } from '$lib/utils'

/**
 * Base Game Scope
 *
 * Foundation scope containing game content enums and common validators.
 * This is separated to avoid circular dependencies - domain files can import
 * this without importing the full arktype.ts
 */

// Extract keys for enums
const goodTypes = Object.keys(goodsCatalog) as Array<keyof typeof goodsCatalog>
const terrainTypes = Object.keys(terrain) as Array<keyof typeof terrain>
const depositTypes = Object.keys(deposits) as Array<keyof typeof deposits>
const alveolusTypes = Object.keys(alveoli) as Array<keyof typeof alveoli>

// Base scope with game content enums, validation helpers, job types, and plan types
// ALL TYPES DEFINED WITH STRINGS ONLY!
export const baseGameScope = scope({
	...positionScope.export(),
	// Game content enums
	GoodType: type.enumerated(...goodTypes),
	TerrainType: type.enumerated(...terrainTypes),
	DepositType: type.enumerated(...depositTypes),
	AlveolusType: type.enumerated(...alveolusTypes),

	// Job and activity types
	JobType: type.enumerated('harvest', 'transform', 'convey', 'offload', 'gather', 'construct'),
	ActivityType: type.enumerated('idle', 'walk', 'work', 'eat', 'sleep', 'ponder'),
	NeedType: type.enumerated('hunger', 'tiredness', 'fatigue'),

	// TODO partial<record<GoodType, number>>
	// Goods type - commonly used
	Goods: {
		'berries?': 'number',
		'mushrooms?': 'number',
		'planks?': 'number',
		'stone?': 'number',
		'wood?': 'number',
	},

	// Job and Needs types
	Job: {
		type: 'JobType',
		fatigue: 'number',
		urgency: 'number',
	},
	Needs: {
		hunger: 'number',
		tiredness: 'number',
		fatigue: 'number',
	},

	// Plan types (all string-based!)
	TransferPlan: {
		type: "'transfer'",
		description: "'grab' | 'drop'",
		goods: 'Goods',
		'target?': 'object',
	},

	PickupPlan: {
		type: "'pickup'",
		goodType: 'GoodType',
		'target?': 'object',
	},

	WorkPlan: {
		type: "'work'",
		jobType: 'JobType',
		'target?': 'object', // TileContent validated at runtime
	},

	Plan: () => baseGameScope.type('TransferPlan | PickupPlan | WorkPlan'),
})

// Export base types module for use in other files
export const baseGameTypes = baseGameScope.export()

// Export runtime validators
export const GoodType = baseGameTypes.GoodType
export const TerrainType = baseGameTypes.TerrainType
export const DepositType = baseGameTypes.DepositType
export const AlveolusType = baseGameTypes.AlveolusType
export const JobType = baseGameTypes.JobType
export const ActivityType = baseGameTypes.ActivityType
export const NeedType = baseGameTypes.NeedType
export const Goods = baseGameTypes.Goods
export const Job = baseGameTypes.Job
export const Needs = baseGameTypes.Needs
export const Position = baseGameTypes.Position
export const TransferPlan = baseGameTypes.TransferPlan
export const PickupPlan = baseGameTypes.PickupPlan
export const WorkPlan = baseGameTypes.WorkPlan
export const Plan = baseGameTypes.Plan

// Export TypeScript type aliases (same names, dual export!)
export type GoodType = typeof GoodType.infer
export type TerrainType = typeof TerrainType.infer
export type DepositType = typeof DepositType.infer
export type AlveolusType = typeof AlveolusType.infer
export type JobType = typeof JobType.infer
export type ActivityType = typeof ActivityType.infer
export type NeedType = typeof NeedType.infer
export type Goods = typeof Goods.infer
export type Job = typeof Job.infer
export type Needs = typeof Needs.infer

// TypeScript interfaces for runtime use (augmented with runtime-only fields)
// These extend the validated plan types with allocation management
export interface TransferPlan<T extends AllocationBase = AllocationBase> {
	readonly type: 'transfer'
	readonly description: 'grab' | 'drop'
	vehicleAllocation?: T // Runtime-only field
	allocation?: T // Runtime-only field
	readonly goods: Goods
	readonly target?: Positioned
}

export interface PickupPlan<T extends AllocationBase = AllocationBase> {
	readonly type: 'pickup'
	vehicleAllocation?: T // Runtime-only field
	allocation?: T // Runtime-only field
	readonly goodType: GoodType
	readonly target: Positioned
	releaseStopper?: () => void // Runtime-only field
}

export interface WorkPlan {
	readonly type: 'work'
	readonly jobType: JobType
	readonly target: TileContent
}

export type Plan = TransferPlan | PickupPlan | WorkPlan
