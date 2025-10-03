import { computed, ReactiveBase, reactive } from 'mutts/src'
import type { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { type AxialCoord, findPath, type Positioned, setPop } from '$lib/utils'
import { AxialKeyMap } from '$lib/utils/mem'
import { toAxialCoord } from '../../utils/position'
import { type HexBoard, isTileCoord } from '../board/board'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
import type { AllocationBase, Storage } from '../storage'
export interface MovingGood {
	goodType: GoodType
	path: AxialCoord[]
	provider: Alveolus
	demander: Alveolus
	allocations: {
		source: AllocationBase
		target: AllocationBase
	}
	hop(): AxialCoord
	finish(): void
}
export type HiveDemanderQueue = { demanders: Set<Alveolus> }
export type HiveProviderQueue = { providers: Set<Alveolus> }
export type HiveQueue = HiveDemanderQueue | HiveProviderQueue
@reactive
export class Hive extends ReactiveBase {
	private constructor(public readonly board: HexBoard) {
		super()
	}
	// Path cache for complete paths between alveoli
	private pathCache = new Map<string, AxialCoord[]>()

	//#region Hives management on tile add/remove
	static for(tile: Tile) {
		const hives = new Set<Hive>()
		for (const neighbor of tile.neighborTiles)
			if (neighbor?.content instanceof Alveolus) hives.add(neighbor.content.hive)
		if (hives.size === 0) return new Hive(tile.board)
		if (hives.size === 1) return setPop(hives)!
		const hivesArray = Array.from(hives)
		// TODO: ask which hive, or detail which configuration to keep in the ui
		const hive = hivesArray.shift()!
		for (const hive of hivesArray) for (const alveolus of hive.alveoli) hive.attach(alveolus)
		return hive
	}
	public name?: string
	public readonly alveoli = new Set<Alveolus>()
	private readonly queues: Map<GoodType, HiveQueue> = new Map()
	@computed
	get byActionType() {
		const rv: Partial<Record<Ssh.Action['type'], Alveolus[]>> = {}
		for (const alveolus of this.alveoli) {
			const type = alveolus.action.type
			if (!rv[type]) rv[type] = []
			rv[type].push(alveolus)
		}
		return rv
	}
	public attach(alveolus: Alveolus) {
		this.alveoli.add(alveolus)
		alveolus.hive = this
		this.invalidatePathCache()
	}
	/**
	 * This hive is defined as a copy of another hive after an alveolus removal didn't divide it
	 * @param hive
	 */
	private copyFrom(hive: Hive) {
		if (hive.name) this.name = hive.name
		for (const [goodType, queue] of hive.queues) this.queues.set(goodType, queue)
	}
	/**
	 * This hive is defined as a part of another hive who had just been divided by an alveolus removal
	 * @param hive
	 */
	private partOf(hive: Hive) {
		if (hive.name) this.name = `${hive.name} - ${Math.random().toString(36).substring(2, 5)}`
		const filteredQueue = (which: 'demanders' | 'providers', queue: HiveQueue) => {
			if (which in queue) {
				const mySet = new Set<Alveolus>()
				// @ts-expect-error `which` is guaranteed to be in queue
				for (const alveolus of queue[which]) if (alveolus.hive === this) mySet.add(alveolus)
				if (mySet.size > 0) return { [which]: mySet } as HiveQueue
			}
		}
		for (const [goodType, queue] of hive.queues) {
			const q = filteredQueue('demanders', queue) || filteredQueue('providers', queue)
			if (q) this.queues.set(goodType, q)
		}
	}
	/**
	 * Has to be called *after* tile.content is not a alveolus anymore
	 * @param alveolus
	 */
	removeAlveolus(alveolus: Alveolus) {
		this.alveoli.delete(alveolus)
		this.invalidatePathCache()
		const toPlaceAlveoli = new Set(this.alveoli)
		const hives: Hive[] = []

		while (toPlaceAlveoli.size > 0) {
			const hive = new Hive(this.board)
			hives.push(hive)
			const toAddSet = new Set<Alveolus>()
			toAddSet.add(setPop(toPlaceAlveoli)!)
			while (toAddSet.size > 0) {
				const alveolus = setPop(toAddSet)!
				hive.attach(alveolus)
				for (const neighbor of alveolus.neighborAlveoli)
					if (!hive.alveoli.has(neighbor)) toAddSet.add(neighbor)
			}
		}
		if (hives.length === 1) return hives[0].copyFrom(this)
		for (let i = 0; i < hives.length - 1; i++) hives[i].partOf(this)
	}
	//#endregion

	//#region Path caching
	private invalidatePathCache() {
		this.pathCache.clear()
	}

	private getPath(from: Alveolus, to: Alveolus, goodType: GoodType): AxialCoord[] | undefined {
		const fromCoord = toAxialCoord(from.tile.position)
		const toCoord = toAxialCoord(to.tile.position)
		const key = `${fromCoord.q},${fromCoord.r}-${toCoord.q},${toCoord.r}-${goodType}`

		if (this.pathCache.has(key)) {
			return this.pathCache.get(key)!
		}

		// Use actual pathfinding to get the complete path
		const path = findPath(
			(c) => this.getNeighborsForGood(c, goodType).map((n) => toAxialCoord(n)),
			fromCoord,
			toCoord,
			Number.POSITIVE_INFINITY,
			true,
		)

		if (path && path.length > 0) {
			// Remove the start coordinate as we know it
			path.shift()
			this.pathCache.set(key, path)
			return path
		}

		return undefined
	}

	private getPathDistance(from: Alveolus, to: Alveolus, goodType: GoodType): number {
		const path = this.getPath(from, to, goodType)
		return path ? path.length : Number.POSITIVE_INFINITY
	}

	private findNearest<T extends Alveolus>(
		from: Alveolus,
		candidates: Set<T>,
		goodType: GoodType,
	): T | undefined {
		if (candidates.size === 0) return undefined

		let nearest: T | undefined
		let minDistance = Number.POSITIVE_INFINITY

		for (const candidate of candidates) {
			const distance = this.getPathDistance(from, candidate, goodType)
			if (distance < minDistance) {
				minDistance = distance
				nearest = candidate
			}
		}

		return nearest
	}
	//#endregion

	getNeighborsForGood(ref: Positioned, _goodType: GoodType) {
		const coord = toAxialCoord(ref)
		if (isTileCoord(coord)) {
			const content = this.board.getTileContent(ref) as Alveolus
			return content.gates.map((g) => g.border.position)
		}
		// Get a border's neighbors - find tileA's and tileB's borders who are gates but not me
		const border = this.board.getBorder(ref)!
		function notMeGates(tile: Tile) {
			return tile.content instanceof Alveolus && tile.content.conveyor ? [tile.position] : []
		}
		return [...notMeGates(border.tile.a), ...notMeGates(border.tile.b)]
	}
	//#region Needy / events
	get needs() {
		const needsSet = new Set<GoodType>()
		for (const [good, queue] of this.queues) {
			if ('demanders' in queue) needsSet.add(good)
		}
		return needsSet
	}

	get provides() {
		const providesSet = new Set<GoodType>()
		for (const [good, queue] of this.queues) {
			if ('providers' in queue) providesSet.add(good)
		}
		return providesSet
	}
	movingGoods = reactive(new AxialKeyMap<MovingGood[]>())
	storageAt(coord: Positioned): Storage<any> | undefined {
		if (isTileCoord(toAxialCoord(coord))) {
			const content = this.board.getTileContent(coord) as Alveolus
			return content.storage
		}
		const border = this.board.getBorder(coord)!
		return border.content
	}
	private getQueue(goodType: GoodType) {
		return this.queues.get(goodType)
	}

	public createMovement(goodType: GoodType, provider: Alveolus, demander: Alveolus) {
		const positions = {
			provider: toAxialCoord(provider.tile.position),
			demander: toAxialCoord(demander.tile.position),
		}
		const { movingGoods } = this

		// Use cached path if available, otherwise calculate it
		const path = [...this.getPath(provider, demander, goodType)!]
		if (!path || path.length < 1) return false
		const reason = {
			type: 'hive-transfer',
			goodType,
			...positions,
		}
		const providerToken = provider.storage.reserve({ [goodType]: 1 }, reason)
		const demanderToken = demander.storage.allocate({ [goodType]: 1 }, reason)
		let from = positions.provider
		let list = this.movingGoods.get(from) ?? []
		function removeFromList(good: MovingGood) {
			list.splice(list.indexOf(good), 1)
			if (list.length === 0) movingGoods.delete(from)
		}
		const movingGood: MovingGood = {
			goodType,
			path,
			provider,
			demander,
			allocations: {
				source: providerToken,
				target: demanderToken,
			},
			hop() {
				const rv = path.shift()!
				removeFromList(movingGood)
				if (movingGood.path.length) {
					from = rv
					if (!movingGoods.has(rv)) movingGoods.set(rv, [])
					list = movingGoods.get(rv)!
					list.push(movingGood)
				}
				return rv
			},
			finish() {
				removeFromList(movingGood)
			},
		}
		list.push(movingGood)
		movingGoods.set(from, list)
		return true
	}

	provide(goodType: GoodType, provider: Alveolus) {
		const q = this.getQueue(goodType)
		if (!q) {
			// If no demander, choose the nearest storage
			const storages = new Set<Alveolus>()
			for (const alveolus of this.alveoli) {
				if (alveolus.action.type === 'storage' && alveolus.canTake(goodType) > 0) {
					storages.add(alveolus)
				}
			}
			if (storages.size === 0) {
				this.queues.set(goodType, { providers: new Set([provider]) })
				// No storage found, we have no place to put the good
				// TODO: show the building in "overflowing" flag
				return
			}
			const storage = this.findNearest(provider, storages, goodType)
			assert(storage !== undefined, 'Storage found but none reachable')
			this.createMovement(goodType, provider, storage)
			storage.poke()
			return
		}
		if ('providers' in q) {
			q.providers.add(provider)
			return
		}
		assert('demanders' in q, 'Providers are present but none reachable')
		// Choose the nearest demander
		const demander = this.findNearest(provider, q.demanders, goodType)
		assert(demander !== undefined, 'Demanders are present but none reachable')
		this.createMovement(goodType, provider, demander)
		demander.poke()
		q.demanders.delete(demander)
		if (q.demanders.size === 0) this.queues.delete(goodType)
	}

	demand(goodType: GoodType, demander: Alveolus) {
		const q = this.getQueue(goodType)
		if (!q) {
			// Try to satisfy immediately from nearest storage with stock
			const storages = new Set<Alveolus>()
			for (const alveolus of this.alveoli) {
				if (alveolus.action.type === 'storage' && alveolus.canGive(goodType) > 0) {
					storages.add(alveolus)
				}
			}
			if (storages.size === 0) return this.queues.set(goodType, { demanders: new Set([demander]) })
			const storage = this.findNearest(demander, storages, goodType)
			assert(storage !== undefined, 'Storage found but none reachable')
			this.createMovement(goodType, storage, demander)
			storage.poke()
			return
		}
		if ('demanders' in q) {
			q.demanders.add(demander)
			return
		}

		// Providers exist: choose nearest and assert reachable
		assert('providers' in q, 'Demanders are present but none reachable')
		const provider = this.findNearest(demander, q.providers, goodType)
		assert(provider !== undefined, 'Providers are present but none reachable')
		this.createMovement(goodType, provider, demander)
		provider.poke()
		q.providers.delete(provider)
		if (q.providers.size === 0) this.queues.delete(goodType)
	}

	/**
	 * Answer a need for a specific good type from a storage alveolus
	 * @param goodType The type of good needed
	 * @param source The storage alveolus that can provide the good
	 * @returns true if a movement was created, false otherwise
	 */
	public answerNeed(goodType: GoodType, source: Alveolus): boolean {
		const queue = this.getQueue(goodType)
		if (!queue || !('demanders' in queue) || queue.demanders.size === 0) {
			return false
		}

		if (source.canGive(goodType) <= 0) {
			return false
		}

		const demander = this.findNearest(source, queue.demanders, goodType)
		if (!demander) {
			return false
		}

		this.createMovement(goodType, source, demander)
		queue.demanders.delete(demander)
		if (queue.demanders.size === 0) this.queues.delete(goodType)
		demander.poke()
		return true
	}

	/**
	 * Answer a provision request for a specific good type to a storage alveolus
	 * @param goodType The type of good being provided
	 * @param source The storage alveolus that can accept the good
	 * @returns true if a movement was created, false otherwise
	 */
	public answerProvision(goodType: GoodType, source: Alveolus): boolean {
		const queue = this.getQueue(goodType)
		if (!queue || !('providers' in queue) || queue.providers.size === 0) {
			return false
		}

		if (source.canTake(goodType) <= 0) {
			return false
		}

		const provider = this.findNearest(source, queue.providers, goodType)
		if (!provider) {
			return false
		}

		this.createMovement(goodType, provider, source)
		queue.providers.delete(provider)
		if (queue.providers.size === 0) this.queues.delete(goodType)
		provider.poke()
		return true
	}

	pokeAll() {
		for (const alveolus of this.alveoli) alveolus.poke()
	}
	//#endregion
}
