export * from './character'
export * from './vehicle'
export * from './vehicle/by-hands'
import { AxialSet } from '$lib/mem'
import { type RandGenerator, uuid } from '$lib/numbers'
import type { AxialCoord } from '$lib/hex'
import { GameObject, withContainer, withHittable } from '../object'
import type { Game } from '../game'
import { UnBuiltLand } from '../board/content'
import { Character } from './character'

export class Population extends withContainer(withHittable(GameObject)) {
	private characters: Map<string, Character> = new Map()

	public characterGen: RandGenerator
	constructor(public readonly game: Game) {
		super(game)
		this.characterGen = game.lcg('characterGen')
		this.zIndex = 1 // Foreground layer - characters should be hit-tested first
	}

	hitTest(worldX: number, worldY: number, selectedAction?: string): any {
		if (selectedAction && selectedAction !== 'select') return false
		const coord = this.game.hex.world2axial({ x: worldX, y: worldY })
		// Check if any character is hit
		for (const character of this.characters.values()) {
			if (character.hitTest(coord, selectedAction)) return character
		}
		return false
	}
	generateCharacters(n: number = 3, radius = 200): void {
		const used = new AxialSet()
		for (let i = 0; i < n; i++) {
			const characterPath = this.game.hex.findNearest(
				{ q: 0, r: 0 },
				(c) => {
					if (used.has(c)) return false
					const tile = this.game.hex.getTile(c)!
					return (
						tile.content instanceof UnBuiltLand &&
						tile.content.terrain !== 'water' &&
						tile.content.deposit === undefined
					)
				},
				5,
			)
			if (characterPath) {
				const characterCoord = characterPath.pop()!
				this.createCharacter(`Character ${i}`, characterCoord)
				used.add(characterCoord)
			} else break
		}
	}

	// Create a new character
	createCharacter(name: string, coord: AxialCoord): Character {
		// Generate a proper UUID for the character
		const characterUid = uuid(this.characterGen)
		const character = new Character(this.game, characterUid, name, coord)
		this.characters.set(characterUid, character)
		this.add(character)
		return character
	}

	// Remove a character
	removeCharacter(name: string): boolean {
		const character = this.characters.get(name)
		if (character) {
			this.characters.delete(name)
			this.delete(character)
			return true
		}
		return false
	}
	get nbrFree(): number {
		return Array.from(this.characters.values()).reduce(
			(acc, character) => (character.assignedModule === undefined ? acc + 1 : acc),
			0,
		)
	}
}
