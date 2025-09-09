import D from "flat-diamond"
import { computed, effect, Reactive, untracked, watch, type ScopedCallback } from "mutts"
import { ColorMatrixFilter, Sprite } from "pixi.js"
import { mrg } from "$lib/globals.svelte"
import { type AxialCoord, axial, type WorldCoord } from "$lib/hex"
import { AxialSet } from "$lib/mem"
import { type RandGenerator, uuid } from "$lib/numbers"
import ActivityManager, { CancelledError } from "./activities/manager"
import { goEat, goRest, goSleep } from "./activities/self-care"
import type { Game } from "./game"
import {
	GeneratorObject,
	HittableGameObject,
	InteractiveGameObject,
	RenderableContainer,
	TickedGameObject,
} from "./object"
import { UnBuiltLand, type GoodType, type Module } from "./tile"

export class Character extends Reactive(
	D(GeneratorObject, InteractiveGameObject, TickedGameObject),
) {
	readonly triggerLevels = {
		hunger: {
			high: 700,
			critical: 1000,
			satisfied: 100,
		},
		Tiredness: {
			high: 2100,
			critical: 2500,
			satisfied: 100,
		},
		fatigue: {
			high: 140,
			critical: 180,
			satisfied: 10,
		},
	} as const
	readonly evolutionRates = {
		idle: {
			hunger: 2,
			Tiredness: 2,
			fatigue: 0,
		},
		walking: {
			hunger: 8,
			Tiredness: 5,
			fatigue: 10,
		},
		active: {
			hunger: 12,
			Tiredness: 8,
			fatigue: 15,
		},
	} as const

	public assignedModule: Module | undefined = undefined
	public activityManager = new ActivityManager<Character>(this)

	// Character needs levels (starting at 0, incrementing 1 per second)
	public hunger: number = 0
	public Tiredness: number = 0
	public fatigue: number = 0

	// Character inventory
	public carriedType?: GoodType
	public carriedAmount: number = 0
	public carryingCapacity: number = 10

	constructor(
		public readonly game: Game,
		public readonly uid: string,
		public name: string,
		public coord: AxialCoord,
	) {
		super(game, uid)
		watch(() => this.assignedModule, () => {
			if (this.assignedModule !== undefined) {
				this.fatigue = this.triggerLevels.fatigue.high
				// TODO: remove me when urgency is working
				goRest(this.activityManager.plan)
			}
		})
	}

	get title(): string {
		return this.name
	}

	// @ts-expect-error Diamond inheritance conflict
	canAct(action: string): boolean {
		// Characters can't be built on
		if (action.startsWith('build:')) {
			return false
		}
		// For other actions, characters might be able to act
		// This could be expanded based on character state, assigned module, etc.
		return false
	}

	get debugInfo(): Record<string, any> {
		return {
			name: this.name,
			coord: this.coord,
		}
	}

	@computed
	get position(): WorldCoord {
		return this.game.hex.axial2world(this.coord)
	}

	hitTest(coord: AxialCoord, selectedAction?: string): boolean {
		// Simple circular hit test for character
		// If we have a selected action, check if this character can act with it
		if (selectedAction && !this.canAct(selectedAction)) {
			return false
		}
		return axial.distance(coord, this.coord) <= 0.3
	}

	// Update character needs levels based on time elapsed
	// @ts-expect-error Diamond member
	update(deltaTime: number) {
		this.hunger += deltaTime
		this.Tiredness += deltaTime
		this.fatigue += deltaTime

		if (!this.activityManager.activity)
			this.findAction().catch((error) => {
				if (!(error instanceof CancelledError)) console.error(error.stack)
			})
		this.activityManager.evolve(deltaTime)
	}

	findAction() {
		if (this.hunger > this.triggerLevels.hunger.high) return goEat(this.activityManager.plan)
		if (this.Tiredness > this.triggerLevels.Tiredness.high)
			return goSleep(this.activityManager.plan)
		if (
			this.fatigue > this.triggerLevels.fatigue.high &&
			this.assignedModule !== undefined
		) return goRest(this.activityManager.plan)
		return this.activityManager.idle(1)
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

	hitTest(worldX: number, worldY: number, selectedAction?: string): InteractiveGameObject | false {
		if(selectedAction && selectedAction !== 'select') return false
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
						tile.content.terrain !== "water" &&
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
			if (character.assignedModule !== undefined) continue

			// Calculate distance using axial distance
			const distance = axial.distance(coord, character.coord)

			if (distance < nearestDistance) {
				nearestDistance = distance
				nearestCharacter = character
			}
		}

		return nearestCharacter
	}
	get nbrFree(): number {
		return Array.from(this.characters.values()).reduce(
			(acc, character) => (character.assignedModule === undefined ? acc + 1 : acc),
			0,
		)
	}
}
