import { Position } from "$lib/game/position"
import { ScriptExecution } from "$lib/game/npcs/scripts"
import { Character } from "$lib/game/character"
import type { GoodType } from "$lib/game/tile"

/**
 * Functions implemented in the npcs files
 */
export type CharacterScripts = {
	walk: {
		into(target: Position): ScriptExecution<Character>
	}
	inventory: {
		dropAll(): ScriptExecution<Character>
	}
	selfCare: {
		goEat(): ScriptExecution<Character>
	}
}