declare namespace Ssh {
	interface SpriteDefinition {
		file: string
		atlas?: string
	}
	type FileSprite = { image: string }
	type AtlasSprite = { atlas: string; frame?: string }
	type Sprite = FileSprite | AtlasSprite
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
		sprites: Sprite[]
	}
	interface GoodsDefinition {
		name: string
		feedingValue: number
		sprites: Sprite[]
	}
}

/*
goods_id = "berries"
display_name = "Berries"
mesh_path = "res://assets/models/goods/berries.obj"
feeding_value = 72.0 

goods_id = "mushrooms"
display_name = "Mushrooms"
mesh_path = "res://assets/models/goods/mushrooms.obj"
feeding_value = 60.0 

goods_id = "planks"
display_name = "Planks"
mesh_path = "res://assets/models/goods/plank.obj"
feeding_value = 0.0 

goods_id = "stone"
display_name = "Stone"
mesh_path = "res://assets/models/goods/stone.obj"
feeding_value = 0.0 

goods_id = "wood"
display_name = "Wood"
mesh_path = "res://assets/models/goods/wood.obj"
*/
