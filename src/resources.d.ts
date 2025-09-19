declare namespace Ssh {
	// TODO: kill all the `name`
	type SpriteDefinition = string
	type Sprite = string
	interface DepositDefinition {
		name?: string
		maxAmount: number
		regenerate?: number
		sprites: Sprite[]
		generation?: {
			goods?: Record<string, number>
		}
	}

	interface HarvestingAction {
		type: 'harvest'
		deposit: string
	}

	interface TransformationAction {
		type: 'transform'
		inputs: Record<string, number>
	}
	type Action = HarvestingAction | TransformationAction

	interface ModuleDefinition {
		name?: string
		preparationTime: number
		action: Action
		output: Record<string, number>
		workTime: number
		icon: Sprite
		sprites: Sprite[]
	}
	interface GoodsDefinition {
		feedingValue: number
		icon: Sprite
		sprites: Sprite[]
	}
	interface TerrainDefinition {
		generation?: {
			deposits?: Record<string, number>
			goods?: Record<string, number>
		}
	}

	type ActivityType = 'idle' | 'walk' | 'work' | 'eat' | 'sleep' | 'rest' | 'convey'

	type NeedType = 'hunger' | 'tiredness' | 'fatigue'
}
