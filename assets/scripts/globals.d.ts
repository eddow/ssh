import { Position } from "$lib/game/position"
import { ScriptExecution } from "$lib/game/npcs/scripts"
import { Character } from "$lib/game/character"

export type CharacterScripts = {
	walk: {
		into(target: Position): ScriptExecution<Character>
	}
}