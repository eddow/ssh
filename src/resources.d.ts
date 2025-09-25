declare namespace Ssh {
	// TODO: kill all the `name`
	type SpriteDefinition = string
	type Sprite = string
	interface DepositDefinition {
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
		output: Record<string, number>
	}

	interface TransformationAction {
		type: 'transform'
		inputs: Record<string, number>
		output: Record<string, number>
	}
	interface TransitAction {
		type: 'transit'
		individual: boolean
	}
	type Action = HarvestingAction | TransformationAction | TransitAction

	interface AlveolusDefinition<ActionType extends Action = Action> {
		preparationTime: number
		action: ActionType
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
