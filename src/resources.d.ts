
declare namespace Ssh {
	type SpriteDefinition = string
	type Sprite = string
	interface DepositDefinition {
		name: string
		maxAmount: number
		regenerate?: number
		sprites: Sprite[]
		terrain: string
	}

	interface HarvestingAction {
		type: "harvest"
		deposit: string
	}

	interface TransformationAction {
		type: "transform"
		inputs: Record<string, number>
	}
	type Action = HarvestingAction | TransformationAction

	interface ModuleDefinition {
		name: string
		maxWorkers: number
		carryingCapacity: number
		restEase: number
		goodsCapacity: number
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
		deposits: Record<string, number>
		goods: Record<string, number>
	}
}
