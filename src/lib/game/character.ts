import { effect, reactive, type ScopedCallback, watch } from 'mutts'
import { ColorMatrixFilter, Sprite } from 'pixi.js'
import {
	characterCapacity,
	characterEvolutionRates,
	characterTriggerLevels,
} from '$assets/constants'
import type { GoodType } from '$lib/arktype'
import { mrg } from '$lib/globals.svelte'
import { type AxialCoord, axial } from '$lib/hex'
import { AxialSet } from '$lib/mem'
import { type RandGenerator, uuid } from '$lib/numbers'
import type { Game } from './game'
import { type Module, type Tile, UnBuiltLand } from './hex/tile'
import aCharacterContext from './npcs/character'
// biome-ignore lint/correctness/noUnusedImports: We need it for mixins tranquility: all propertyKeys are known
import { subject } from './npcs/scripts'
import type { ASingleStep } from './npcs/steps'
import {
	GameObject,
	withContainer,
	withGenerator,
	withHittable,
	withInteractive,
	withScripted,
	withTicked,
} from './object'
import { type Position, toAxialCoord, toWorldCoord } from './position'

//import * as allScripts from "./npcs/scripts"
//console.log(allScripts)

type ActionType = 'idle' | 'walk' | 'work'

export function withCharacterStep<
	Args extends any[],
	T extends new (
		...args: any[]
	) => ASingleStep,
>(Base: T, actionType: ActionType) {
	abstract class CharacterStepMixin extends Base {
		constructor(...args: any[]) {
			super(...(args as Args))
		}
		readonly actionType: ActionType = actionType
	}
	return CharacterStepMixin
}

@reactive
export class Character extends withInteractive(
	withScripted(withTicked(withGenerator(GameObject))),
) {
	readonly triggerLevels = characterTriggerLevels

	public assignedModule: Module | undefined = undefined

	// Character needs levels (starting at 0, incrementing 1 per second)
	public hunger: number = 0
	public tiredness: number = 0
	public fatigue: number = 0

	// Character inventory
	public carriedType?: GoodType
	public carriedAmount: number = 0
	public carryingCapacity: number = characterCapacity.carryingCapacity
	public scriptsContext = aCharacterContext(this)
	public tile: Tile
	constructor(
		game: Game,
		uid: string,
		public name: string,
		public position: Position,
	) {
		super(game, uid)
		this.tile = game.hex.getTile(toAxialCoord(this.position))!
		watch(
			() => this.assignedModule,
			() => {
				if (this.assignedModule !== undefined) {
					this.fatigue = this.triggerLevels.fatigue.high
					// TODO: remove me when urgency is working
					//goRest(this.activityManager.plan)
				}
			},
		)
	}

	get title(): string {
		return this.name
	}

	canInteract(action: string): boolean {
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
			coord: this.position,
		}
	}

	hitTest(coord: AxialCoord, selectedAction?: string): boolean {
		// Simple circular hit test for character
		// If we have a selected action, check if this character can act with it
		if (selectedAction && !this.canInteract(selectedAction)) {
			return false
		}
		return axial.distance(coord, toAxialCoord(this.position)) <= 0.3
	}

	// Update character needs levels based on time elapsed
	update(deltaTime: number) {
		const activity: Ssh.ActivityType = (this.stepExecutor?.type ?? 'idle') as Ssh.ActivityType
		const hungerRate =
			characterEvolutionRates.hunger[activity] ?? characterEvolutionRates.hunger['*'] ?? 0
		const tirednessRate =
			characterEvolutionRates.tiredness[activity] ?? characterEvolutionRates.tiredness['*'] ?? 0
		const fatigueRate =
			characterEvolutionRates.fatigue[activity] ?? characterEvolutionRates.fatigue['*'] ?? 0
		this.hunger += hungerRate * deltaTime
		this.tiredness += tirednessRate * deltaTime
		this.fatigue += fatigueRate * deltaTime
		super.update(deltaTime)
	}

	findAction() {
		if (this.hunger > this.triggerLevels.hunger.high) return this.scriptsContext.selfCare.goEat()
		// Default to wandering when no specific action is needed
		return this.scriptsContext.selfCare.wander()
	}

	render(): ScopedCallback | undefined {
		const { game } = this

		// Create character sprite
		const characterSprite = new Sprite(game.getTexture('character'))
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
			const { x, y } = toWorldCoord(this.position)
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
			const distance = axial.distance(coord, toAxialCoord(character.position))

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

// ArkType validation for Character
import { type } from 'arktype'
export const CharacterType = type.instanceOf(Character)
