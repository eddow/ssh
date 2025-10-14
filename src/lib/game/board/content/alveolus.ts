import { type ScopedCallback, unreactive } from 'mutts/src'
import { Sprite } from 'pixi.js'
import type { Hive, MovingGood } from '$lib/game/hive/hive'
import { gameIsaTypes } from '$lib/game/npcs/utils'
import type { Character } from '$lib/game/population/character'
import type { GoodType } from '$lib/types'
import type { Job } from '$lib/types/base'
import { type AxialCoord, axial, epsilon, tileSize } from '$lib/utils'
import { toAxialCoord, toWorldCoord } from '$lib/utils/position'
import { renderTileGoods, type Storage } from '../../storage'
import { AlveolusGate } from '../border/alveolus-gate'
import type { Tile } from '../tile'
import { TileContent } from './content'
import { UnBuiltLand } from './unbuilt-land'
import { GcClassed } from './utils'

//reactiveOptions.maxEffectChain = 1000
interface LocalMovingGood extends MovingGood {
	from: AxialCoord
}

@unreactive
export abstract class Alveolus extends GcClassed<Ssh.AlveolusDefinition, typeof TileContent>(
	TileContent,
) {
	public assignedWorker: Character | undefined
	public tile: Tile
	public declare hive: Hive
	public storage: Storage<any>
	// Configurable properties removed - walkway and conveyor are no longer used
	public advertisingEffect?: ScopedCallback

	constructor(tile: Tile, storage: Storage<any>) {
		const tileCoord = toAxialCoord(tile.position)
		super(tile.board.game, `alveolus:${tileCoord.q},${tileCoord.r}`)
		this.storage = storage
		this.tile = tile

		// Only create gates between two alveoli
		for (const surrounding of this.tile.surroundings) {
			// Check if the neighboring tile also contains an alveolus
			if (surrounding.tile instanceof Alveolus) {
				// Create gate only if one doesn't already exist
				if (!(surrounding.border.content instanceof AlveolusGate)) {
					surrounding.border.content = new AlveolusGate(surrounding.border)
				}
			}
		}
	}

	get debugInfo() {
		return {}
	}
	get walkTime() {
		return 1
	}
	get background() {
		return 'concrete'
	}
	get gates(): AlveolusGate[] {
		return this.tile.surroundings
			.map((b) => b.border.content)
			.filter((b): b is AlveolusGate => b instanceof AlveolusGate)
	}

	// Render tile background, alveolus sprite + a vertical goods bar on the right side of the tile
	render(): ScopedCallback | undefined {
		const size = tileSize
		const worldPos = toWorldCoord(this.tile.position)
		const cleanups: ScopedCallback[] = []

		// Render the tile background first
		cleanups.push(this.renderBackground())

		// Alveolus sprite (centered)
		if (this.sprites?.[0]) {
			const sprite = new Sprite(this.game.getTexture(this.sprites[0]))
			// approximate size scaling similar to hexboard
			const scale = Math.max(sprite.width, sprite.height) / (size * 1.5)
			sprite.scale.set(1 / scale)
			sprite.anchor.set(0.5)
			sprite.position.set(worldPos.x, worldPos.y)
			this.game.alveoliLayer.addChild(sprite)

			cleanups.push(() => {
				this.game.alveoliLayer.removeChild(sprite)
				sprite.destroy()
			})
		}

		// Render stored goods
		const goodsCleanup = renderTileGoods(
			this.game,
			size,
			() => this.storage.renderedGoods(),
			worldPos,
		)
		if (goodsCleanup) cleanups.push(goodsCleanup)

		return () => {
			for (const cleanup of cleanups) cleanup()
		}
	}

	canInteract(_action: string): boolean {
		// Alveoli can't be built on (they already exist)
		return false
	}

	//-@computed
	get isBurdened(): boolean {
		// Check if there are FreeGoods on this tile
		const coord = toAxialCoord(this.tile.position)
		const freeGoods = this.tile.board.freeGoods.getGoodsAt(coord)
		return freeGoods.length > 0
	}

	nextJob?(character?: Character): Job | undefined

	getJob(character?: Character): Job | undefined {
		if (this.assignedWorker) return undefined
		// Don't provide jobs if the alveolus is burdened by FreeGoods
		if (this.isBurdened) return undefined
		const carry = this.conveyJob()
		if (carry) return carry

		return this.nextJob?.(character)
	}

	getFatigueCost(): number {
		// Base fatigue based on action type
		const baseFatigue = this.action.type === 'harvest' ? this.workTime + 2 : this.workTime

		// Add time-based fatigue (if alveolus has time configuration)
		// For now, just return base fatigue
		return baseFatigue
	}

	/**
	 * Find a good movement or a cycle of blocked movements:
	 * - Returns a single movement (as singleton array) if one can advance
	 * - Returns a cycle of movements (A->B, B->C, C->A) if circular blockade detected
	 * - Returns undefined if no movements available
	 */
	//-@computed
	get aGoodMovement(): LocalMovingGood[] | undefined {
		const hive = this.hive
		const here = toAxialCoord(this.tile.position)
		const blocked: LocalMovingGood[] = []

		function canAdvance(mg: MovingGood) {
			const storage = hive.storageAt(mg.path[0])
			return storage?.hasRoom(mg.goodType) || mg.path.length === 1
		}

		// Collect movements at the tile itself
		const atHere = hive.movingGoods.get(here)
		if (atHere) {
			for (const mg of atHere) {
				const localMg = Object.setPrototypeOf({ from: here }, mg) as LocalMovingGood
				if (canAdvance(mg)) {
					return [localMg]
				} else {
					blocked.push(localMg)
				}
			}
		}

		// Collect movements from surroundings (borders)
		for (const { border } of this.tile.surroundings) {
			const from = toAxialCoord(border.position)
			const arr = hive.movingGoods.get(from)
			if (!arr) continue
			for (const mg of arr) {
				if (axial.distance(mg.path[0], here) < 0.5 + epsilon) {
					const localMg = Object.setPrototypeOf({ from }, mg) as LocalMovingGood
					if (canAdvance(mg)) {
						return [localMg]
					} else {
						blocked.push(localMg)
					}
				}
			}
		}

		// No available movements - try to find circular blocks
		if (blocked.length === 0) {
			return undefined
		}

		// Detect circular blockades using DFS
		const cycle = this.findCircularBlock(blocked)
		return cycle
	}

	/**
	 * Find a circular blockade in the list of blocked movements
	 * Returns the cycle as an array of movements, or undefined if no cycle found
	 */
	private findCircularBlock(blocked: LocalMovingGood[]): LocalMovingGood[] | undefined {
		// Build a map from current position to movements
		const movementsByPosition = new Map<string, LocalMovingGood[]>()

		for (const mg of blocked) {
			const key = `${mg.from.q},${mg.from.r}`
			if (!movementsByPosition.has(key)) {
				movementsByPosition.set(key, [])
			}
			movementsByPosition.get(key)!.push(mg)
		}

		// Try to find a cycle starting from each blocked movement
		const visited = new Set<string>()
		const recursionStack = new Set<string>()
		const path: LocalMovingGood[] = []

		/**
		 * Depth-First Search to detect cycles in the movement graph.
		 * Uses the recursion stack to detect back edges that indicate cycles.
		 *
		 * @param mg - The current movement being explored
		 * @returns The cycle as an array of movements if found, undefined otherwise
		 *
		 * Algorithm:
		 * - Tracks visited nodes to avoid re-exploring
		 * - Maintains recursion stack to detect back edges (cycles)
		 * - Builds path during traversal
		 * - When a back edge is found (next position is in recursion stack), extracts the cycle
		 * - Backtracks by removing from recursion stack and path when exploring branch completes
		 */
		function depthFirstSearchForCycle(mg: LocalMovingGood): LocalMovingGood[] | undefined {
			const currentKey = `${mg.from.q},${mg.from.r}`
			const nextKey = `${mg.path[0].q},${mg.path[0].r}`

			visited.add(currentKey)
			recursionStack.add(currentKey)
			path.push(mg)

			// Check if next position creates a cycle (back edge detected)
			if (recursionStack.has(nextKey)) {
				// Found a cycle! Extract the cycle from path
				const cycleStart = path.findIndex((m) => `${m.path[0].q},${m.path[0].r}` === nextKey)
				return path.slice(cycleStart)
			}

			// Explore movements from the next position
			const nextMovements = movementsByPosition.get(nextKey) || []
			for (const nextMg of nextMovements) {
				const nextNextKey = `${nextMg.from.q},${nextMg.from.r}`
				if (!visited.has(nextNextKey)) {
					const result = depthFirstSearchForCycle(nextMg)
					if (result) return result
				}
			}

			// Backtrack: remove from recursion stack and path
			recursionStack.delete(currentKey)
			path.pop()
			return undefined
		}

		// Try DFS from each unvisited blocked movement
		for (const mg of blocked) {
			const key = `${mg.from.q},${mg.from.r}`
			if (!visited.has(key)) {
				const cycle = depthFirstSearchForCycle(mg)
				if (cycle) return cycle
			}
		}

		return undefined
	}
	//TODO: //-@computed
	// when computed, work.npcs:61 throws debugger and then deadlock
	get incomingGoods(): boolean {
		// Note: because borders have 2 neighbors, if a good is incoming, it's for you (you're in one of the neighbors)
		return this.tile.surroundings.some(
			(s) => s.border.content instanceof AlveolusGate && s.border.content.storage.allocatedSlots,
		)
	}

	private conveyJob(): Job | undefined {
		// Provide a convey job only when there are pass-through movements via borders
		// Now handles circular blockades - aGoodMovement will return a cycle to untangle
		// TODO: the chosen movement should be random, not arbitrary
		return this.aGoodMovement ? ({ job: 'convey', fatigue: 3, urgency: 2 } as Job) : undefined
	}

	deconstruct() {
		this.advertisingEffect?.()
		this.tile.content = new UnBuiltLand(this.tile, 'concrete')
		for (const gate of this.gates) gate.border.content = undefined
		this.hive.removeAlveolus(this)
	}

	//-@computed
	get neighborAlveoli(): Alveolus[] {
		return this.tile.neighborTiles
			.map((neighbor) => neighbor?.content)
			.filter((c): c is Alveolus => c instanceof Alveolus)
	}
	abstract advertise(): void

	/**
	 * Check if this alveolus has a specific good in stock
	 * Default implementation delegates to storage
	 */
	canGive(_goodType: GoodType): number {
		return 0
	}

	/**
	 * Check if this alveolus can store a specific good
	 * Default implementation delegates to storage
	 */
	canTake(_goodType: GoodType): number {
		return 0
	}
}
gameIsaTypes.alveolus = (value: any) => {
	return value instanceof Alveolus
}
