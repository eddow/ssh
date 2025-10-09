import { type } from 'arktype'
import { reactive, type ScopedCallback } from 'mutts/src'
import { ColorMatrixFilter, Sprite } from 'pixi.js'
import { characterEvolutionRates, characterTriggerLevels, maxWalkTime } from '$assets/constants'
import { goods as goodsCatalog } from '$assets/game-content'
import type { GoodType } from '$lib/arktype'
import { assert, namedEffect } from '$lib/debug'
import { mrg } from '$lib/globals.svelte'
import { type AxialCoord, axial, maxBy, type Positioned } from '$lib/utils'
import { axialDistance, type Position, toAxialCoord, toWorldCoord } from '../../utils/position'
import type { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
import type { Game } from '../game'
import { bestPossibleJobScore, calculateJobScore, type Job } from '../job'
import aCharacterContext from '../npcs/context'
import { withScripted } from '../npcs/object'
// biome-ignore lint/correctness/noUnusedImports: We need `subject` for mixins tranquility: all propertyKeys are known
import { type ScriptExecution, subject } from '../npcs/scripts'
import { GameObject, withGenerator, withInteractive, withTicked } from '../object'
import { ByHands } from './vehicle/by-hands'
import type { Vehicle } from './vehicle/vehicle'

@reactive
export class Character extends withInteractive(
	withScripted(withTicked(withGenerator(GameObject))),
) {
	readonly triggerLevels = characterTriggerLevels

	public assignedAlveolus: Alveolus | undefined = undefined

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
		const queueStep = this.game.hex.moveCharacter(this, toAxialCoord(this._tile.position))
		assert(!queueStep, 'Character must not be queuing on creation')
		if (queueStep) this.stepExecutor = queueStep

		// Create vehicle (by hands for now) - direct instantiation like Tile->TileContent
		this.vehicle = new ByHands(this)
	}

	/** Attempt to step onto a tile, managing board occupancy. */
	stepOn(tile: Tile) {
		if (axialDistance(this.position, tile.position) > 1.1) return false
		const to = toAxialCoord(tile.position)
		const from = toAxialCoord(this._tile.position)
		const queue = this.game.hex.moveCharacter(this, to, from)
		if (queue)
			return queue.finished(() => {
				this._tile = tile
			})
		this._tile = tile
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
		const scoreJob = (coord: Positioned): number | false => {
			const tile = this.game.hex.getTile(coord)
			if (!tile) return false
			const job = tile.getJob?.()
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
		const job = targetTile.getJob() as Job
		const jobProvider = targetTile.content
		this.log('character.beginJob', job.type)

		// Create and return the work plan - the plan lifecycle will handle state management
		return this.scriptsContext.work.goWork(
			{
				type: 'work',
				jobType: job.type,
				target: jobProvider,
			},
			path,
		)
	}

	get keepWorking(): boolean {
		return (
			this.hunger < this.triggerLevels.hunger.high &&
			this.fatigue < this.triggerLevels.fatigue.high /*&&
			this.tiredness < this.triggerLevels.tiredness.high*/
		)
	}

	get carriedFood(): GoodType | undefined {
		return maxBy(
			Object.entries(this.vehicle.stock) as [GoodType, number][],
			([goodType]) =>
				(this.vehicle.available(goodType) > 0 &&
					'feedingValue' in goodsCatalog[goodType] &&
					(goodsCatalog[goodType].feedingValue as number)) ||
				undefined,
		)?.[0]
	}

	canInteract(action: string): boolean {
		// Characters can't be built on
		if (action.startsWith('build:')) {
			return false
		}
		// For other actions, characters might be able to act
		// This could be expanded based on character state, assigned alveolus, etc.
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
			return this.scriptsContext.inventory.dropAllFree()
		const tryAnActivity =
			// TODO: make sure to dropAllFree before findBestJob - or indeed to find where to drop
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
		const mouseoverEffect = namedEffect('character.mouseover', () => {
			if (mrg.hoveredObject === this) {
				characterSprite.tint = 0xaaaaff
				brightnessFilter.brightness(1.2, false)
			} else {
				characterSprite.tint = 0xffffff
				brightnessFilter.brightness(1, false)
			}
		})
		namedEffect('character.position', () => {
			const { x, y } = toWorldCoord(this.position)
			characterSprite.position.set(x, y)
		})

		// Add to characters layer
		game.charactersLayer.addChild(characterSprite)

		// Return cleanup function
		return () => {
			mouseoverEffect()
			characterSprite.destroy()
			game.charactersLayer.removeChild(characterSprite)
		}
	}
}

// ArkType validation for Character
export const CharacterArkType = type.instanceOf(Character)
