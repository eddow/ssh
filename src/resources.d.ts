declare namespace Ssh {
	type SpriteDefinition = string
	type Sprite = string
	interface DepositDefinition {
		name: string
		maxAmount: number
		regenerate?: number
		sprites: Sprite[]
	}

	interface HarvestingAction {
		type: "harvesting"
		deposit: string
		output: Record<string, number>
		time: number
	}

	interface TransformationAction {
		type: "transformation"
		inputs: Record<string, number>
		outputs: Record<string, number>
		time: number
	}
	type Action = HarvestingAction | TransformationAction

	interface BuildingDefinition {
		name: string
		maxWorkers: number
		carryingCapacity: number
		restEase: number
		goodsCapacity: Record<string, number>
		actions: Action[]
		icon: Sprite
		sprites: Sprite[]
	}
	interface GoodsDefinition {
		name: string
		feedingValue: number
		icon: Sprite
		sprites: Sprite[]
	}
}
