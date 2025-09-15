import { Position } from "$lib/game/position"
import { ScriptExecution } from "$lib/game/npcs/scripts"
import { Character } from "$lib/game/character"
import type { GoodType } from "$lib/game/tile"

export type CharacterScripts = {
	walk: {
		into(target: Position): ScriptExecution<Character>
	}
	find: {
		freeSpot(goodType: GoodType): { tile: any, path: any } | false
	}
	inventory: {
		dropAll(): ScriptExecution<Character>
	}
}