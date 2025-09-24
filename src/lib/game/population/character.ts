import { type } from 'arktype'
import { effect, reactive, type ScopedCallback } from 'mutts'
import { ColorMatrixFilter, Sprite } from 'pixi.js'
import { characterEvolutionRates, characterTriggerLevels, maxWalkTime } from '$assets/constants'
import { goods as goodsCatalog } from '$assets/game-content'
import type { GoodType } from '$lib/arktype'
import { mrg } from '$lib/globals.svelte'
import { type AxialCoord, type AxialRef, axial } from '$lib/hex'
import { maxBy } from '$lib/utils'
import { Module } from '../board/content/module'
import type { Tile } from '../board/tile'
import type { Game } from '../game'
import { bestPossibleJobScore, calculateJobScore, type Job } from '../job'
import aCharacterContext from '../npcs/character'
import { withScripted } from '../npcs/object'
// biome-ignore lint/correctness/noUnusedImports: We need `subject` for mixins tranquility: all propertyKeys are known
import { type ScriptExecution, subject } from '../npcs/scripts'
import { GameObject, withGenerator, withInteractive, withTicked } from '../object'
import { axialDistance, type Position, toAxialCoord, toWorldCoord } from '../position'
import { ByHands } from './vehicle/by-hands'
import type { Vehicle } from './vehicle/vehicle'

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

	// Character vehicle (like Tile has content)
	public vehicle: Vehicle
	public readonly scriptsContext = aCharacterContext(this)
	private _tile!: Tile

	get tile(): Tile {
		return this._tile
	}

	constructor(
		game: Game,
		uid: string,
		public name: string,
		public position: Position,
	) {
		super(game, uid)
		this._tile = game.hex.getTile(toAxialCoord(this.position))!
		// Allocate initial occupancy on the board
		this.game.hex.moveCharacter(this, toAxialCoord(this._tile.position))

		// Create vehicle (by hands for now) - direct instantiation like Tile->TileContent
		this.vehicle = new ByHands(this)
	}

	/** Attempt to step onto a tile, managing board occupancy. */
	stepOn(tile: Tile): boolean {
		if (axialDistance(this.position, tile.position) > 1.1) return false
		const to = toAxialCoord(tile.position)
		const from = toAxialCoord(this._tile.position)
		// TODO: Here if the tile is occupied, queue?
		if (!this.game.hex.moveCharacter(this, to, from)) return false
		this._tile = tile
		return true
	}

	get title(): string {
		return this.name
	}

	/**
	 * Find the best available job using pathfinding
	 * @returns Object with job, tile, and path, or false if no job found
	 */
	findBestJob(): ScriptExecution | false {
		const start = toAxialCoord(this.position)

		// Score function: evaluates how good a job is at a given coordinate
		const scoreJob = (coord: AxialRef): number | false => {
			const content = this.game.hex.getTile(coord)?.content
			if (!(content instanceof Module)) return false
			const job = content.getJob()
			return job ? calculateJobScore(this, job) : false
		}

		// Find the best job using the findBest pathfinding function
		const path = this.game.hex.findBestForCharacter(
			start,
			this,
			scoreJob,
			maxWalkTime, // Use maxWalkTime from constants
			bestPossibleJobScore(this),
			true, // punctual: only consider exact coordinates
		)

		if (!path || path.length === 0) return false

		const targetCoord = path[path.length - 1]
		const targetTile = this.game.hex.getTile(targetCoord)!
		const jobProvider = targetTile.content as Module
		const job = jobProvider.getJob() as Job
		this.log('character.beginJob', job.type)
		jobProvider.assignedWorker = this
		this.assignedModule = jobProvider
		return this.scriptsContext.work.goWork(jobProvider, job.type, path).final(() => {
			this.log('character.finishedJob', job.type)
			jobProvider.assignedWorker = undefined
			this.assignedModule = undefined
		})
	}

	get keepWorking(): boolean {
		return (
			this.hunger < this.triggerLevels.hunger.high &&
			this.fatigue < this.triggerLevels.fatigue.high &&
			this.tiredness < this.triggerLevels.tiredness.high &&
			this.assignedModule!.keepWorking
		)
	}

	get carriedFood(): GoodType | undefined {
		return maxBy(
			Object.entries(this.vehicle.stock) as [GoodType, number][],
			([goodType]) =>
				(this.vehicle.available(goodType) > 0 && goodsCatalog[goodType].feedingValue) || undefined,
		)?.[0]
	}

	get aCarriedGood(): GoodType | undefined {
		return Object.entries(this.vehicle.stock).find(
			([goodType]) => this.vehicle.available(goodType as GoodType) > 0,
		)?.[0] as GoodType | undefined
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
			vehicle: this.vehicle.debugInfo,
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

		if (Object.values(this.vehicle.stock).some((qty) => qty > 0))
			return this.scriptsContext.inventory.dropAll()
		const tryAnActivity =
			// TODO: make sure to dropAll before findBestJob - or indeed to find where to drop
			this.fatigue < this.triggerLevels.fatigue.high ? this.findBestJob() : undefined // goRest
		// Default to wandering when no specific action is needed
		return tryAnActivity || this.scriptsContext.selfCare.wander()
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

// ArkType validation for Character
export const CharacterArkType = type.instanceOf(Character)
