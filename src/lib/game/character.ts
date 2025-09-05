import D from "flat-diamond"
import { effect, type ScopedCallback } from "mutts"
import { ColorMatrixFilter, Sprite } from "pixi.js"
import { type AxialCoord, axial, type WorldCoord } from "$lib/hex"
import { AxialSet } from "$lib/mem"
import { type RandGenerator, uuid } from "$lib/numbers"
import type { Game } from "./game"
import type { Building } from "./hexboard"
import {
	GeneratorObject,
	HittableGameObject,
	InteractiveGameObject,
	RenderableContainer,
} from "./object"
import { mrg } from "$lib/globals.svelte"

export class Character extends D(GeneratorObject, InteractiveGameObject) {
	public assignedBuilding: Building | undefined = undefined

	constructor(
		public readonly game: Game,
		public readonly uid: string,
		public name: string,
		public coord: AxialCoord,
	) {
		super(game, uid)
	}

	get title(): string {
		return this.name
	}

	get debugInfo(): Record<string, any> {
		return {
			name: this.name,
			coord: this.coord,
		}
	}

	get position(): WorldCoord {
		return this.game.hex.axial2world(this.coord)
	}

	hitTest(coord: AxialCoord): boolean {
		// Simple circular hit test for character

		return axial.distance(coord, this.coord) <= 0.7
	}

	render = (): ScopedCallback | undefined => {
		const { game } = this

		// Create character sprite
		const characterSprite = new Sprite(game.getTexture("character"))
		characterSprite.anchor.set(0.5, 0.5)
		game.hex.resizeSprite(characterSprite, 1.2)

		// Hover highlight similar to tiles
		const brightnessFilter = new ColorMatrixFilter()
		characterSprite.filters = [brightnessFilter]
		const mouseoverEffect = effect(() => {
			if (mrg.hoveredObject === this) {
				characterSprite.tint = 0xaaaaff
				brightnessFilter.brightness(1.2, false)
			} else {
				characterSprite.tint = 0xffffff
				brightnessFilter.brightness(1, false)
			}
		})
		effect(() => {
			const { x, y } = this.position
			characterSprite.position.set(x, y)
		})

		// Add to object layer
		game.objectLayer.addChild(characterSprite)

		// Return cleanup function
		return () => {
			mouseoverEffect()
			characterSprite.destroy()
			game.objectLayer.removeChild(characterSprite)
		}
	}
}

export class Population extends D(HittableGameObject, RenderableContainer) {
	private characters: Map<string, Character> = new Map()

	public characterGen: RandGenerator
	constructor(public readonly game: Game) {
		super(game)
		this.characterGen = game.lcg("characterGen")
		this.zIndex = 1 // Foreground layer - characters should be hit-tested first
	}

	hitTest(worldX: number, worldY: number): InteractiveGameObject | false {
		const coord = this.game.hex.world2axial({ x: worldX, y: worldY })
		// Check if any character is hit
		for (const character of this.characters.values()) {
			if (character.hitTest(coord)) return character
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
						tile.terrain !== "water" && tile.building === undefined && tile.deposit === undefined
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

	// Get a character by name
	getCharacter(name: string): Character | undefined {
		return this.characters.get(name)
	}

	// Get a character by UID
	getCharacterByUid(uid: string): Character | undefined {
		return this.characters.get(uid)
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

	// Get all characters
	getAllCharacters(): Character[] {
		return Array.from(this.characters.values())
	}

	// Find the nearest unemployed character to a given coordinate
	findNearestUnemployed(coord: AxialCoord): Character | undefined {
		let nearestCharacter: Character | undefined
		let nearestDistance = Number.POSITIVE_INFINITY

		for (const character of this.characters.values()) {
			// Skip if character is already assigned to a building
			if (character.assignedBuilding !== undefined) continue

			// Calculate distance using axial distance
			const distance = axial.distance(coord, character.coord)

			if (distance < nearestDistance) {
				nearestDistance = distance
				nearestCharacter = character
			}
		}

		return nearestCharacter
	}

	// Get all unemployed characters
	getUnemployedCharacters(): Character[] {
		return Array.from(this.characters.values()).filter(
			(character) => character.assignedBuilding === undefined,
		)
	}

	// Get all employed characters
	getEmployedCharacters(): Character[] {
		return Array.from(this.characters.values()).filter(
			(character) => character.assignedBuilding !== undefined,
		)
	}
}
