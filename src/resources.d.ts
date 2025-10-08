declare namespace Ssh {
	type SpriteDefinition = string
	type Sprite = string

	interface SlottedStorage {
		capacity: number
		slots: number
	}
	interface SpecificStorage {
		[goodType: string]: number
	}
	type StorageAction = SlottedStorageAction | SpecificStorageAction
	interface DepositDefinition {
		maxAmount: number
		regenerate?: number
		sprites: Sprite[]
		generation?: Record<string, number>
	}

	interface HarvestingAction {
		type: 'harvest'
		deposit: string
		output: Record<string, number>
	}

	interface TransformationAction {
		type: 'transform'
		inputs: Record<string, number>
		output: Record<string, number>
	}
	interface GatherAction {
		type: 'gather'
		radius: number
	}
	interface BuildAction {
		type: 'build'
		target: string
	}
	interface EngineerAction {
		type: 'engineer'
		radius: number
	}
	interface SlottedStorageAction {
		type: 'storage'
		capacity: number
		slots: number
	}
	interface SpecificStorageAction {
		type: 'storage'
		[goodType: string]: number
	}
	type Action =
		| HarvestingAction
		| TransformationAction
		| GatherAction
		| BuildAction
		| EngineerAction
		| SlottedStorageAction
		| SpecificStorageAction

	interface AlveolusDefinition<ActionType extends Action = Action> {
		preparationTime: number
		action: ActionType
		workTime: number
		icon: Sprite
		sprites: Sprite[]
		constructionCost: Record<string, number>
	}
	interface GoodsDefinition {
		feedingValue?: number
		icon: Sprite
		sprites: Sprite[]
		halfLife: number
	}
	interface TerrainDefinition {
		generation?: {
			deposits?: Record<string, number>
			goods?: Record<string, number>
		}
	}

	type ActivityType = 'idle' | 'walk' | 'work' | 'eat' | 'sleep' | 'rest' | 'convey' | 'gather'

	type NeedType = 'hunger' | 'tiredness' | 'fatigue'
}
