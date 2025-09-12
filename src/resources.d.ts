declare namespace Ssh {
	type SpriteDefinition = string
	type Sprite = string
	interface DepositDefinition {
		name: string
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
		name: string
		maxWorkers: number
		restEase: number
		action: Action
		output: string
		time: number
		icon: Sprite
		sprites: Sprite[]
	}
	interface GoodsDefinition {
		name: string
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
}
