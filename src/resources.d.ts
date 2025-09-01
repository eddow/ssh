namespace Resources {
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
	interface Deposit extends DepositDefinition {
		amount: number
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
}

/*
building_id = "sawmill"
display_name = "Sawmill"
max_workers = 3
activity_type = "sawmill"
mesh_path = "res://assets/models/building/sawmill.obj"
processing_time = 2.0
carrying_capacity = 1
rest_ease = 50.0
goods_capacity = {"wood": 6, "planks": 12}
actions = [
	{"type": "transformation", "inputs": {"wood": 1}, "outputs": {"planks": 1}, "time": 2.0},
] 


building_id = "shack"
display_name = "Shack"
max_workers = 1
activity_type = "shack"
mesh_path = "res://assets/models/building/shack.obj"
processing_time = 2.0
carrying_capacity = 2
rest_ease = 5.0
goods_capacity = {"berries": 8, "wood": 6, "planks": 8, "stone": 6}
actions = [
	{"type": "transformation", "inputs": {"wood": 1}, "outputs": {"planks": 1}, "time": 6.0},
	{"type": "harvesting", "deposit": "tree", "output": {"wood": 1}, "time": 5.0},
	{"type": "harvesting", "deposit": "berry_bush", "output": {"berries": 1}, "time": 4.0},
	{"type": "harvesting", "deposit": "rock", "output": {"stone": 1}, "time": 6.0},
] 


building_id = "stonecutter"
display_name = "Stone Cutter"
max_workers = 2
activity_type = "stonecutter"
mesh_path = "res://assets/models/building/stone_cutter.obj"
processing_time = 2.0
carrying_capacity = 1
rest_ease = 10.0
goods_capacity = {"stone": 12}
actions = [
	{"type": "harvesting", "deposit": "rock", "output": {"stone": 1}, "time": 4.0},
] 

building_id = "tree_chopper"
display_name = "Tree Chopper"
max_workers = 2
activity_type = "tree_chopper"
mesh_path = "res://assets/models/building/wood_chopper.obj"
processing_time = 2.0
carrying_capacity = 1
rest_ease = 10.0
goods_capacity = {"wood": 12}
actions = [
	{"type": "harvesting", "deposit": "tree", "output": {"wood": 1}, "time": 3.0},
] 
*/
