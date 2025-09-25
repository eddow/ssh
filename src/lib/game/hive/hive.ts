import { computed, ReactiveBase, reactive } from 'mutts'
import type { GoodType } from '$lib/arktype'
import { type AxialCoord, type AxialRef, axial, findPath } from '$lib/hex'
import { AxialKeyMap } from '$lib/mem'
import { setPop } from '$lib/utils'
import { type HexBoard, isTileCoord } from '../board/board'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
import { toAxialCoord } from '../position'
import type { AllocationBase } from '../storage'
export interface MovingGood {
	goodType: GoodType
	path: AxialCoord[]
	provider: Alveolus
	demander: Alveolus
	allocations: {
		provider: AllocationBase
		demander: AllocationBase
	}
	hop(): AxialCoord
	finish(): void
}
export type HiveDemanderQueue = { demanders: Alveolus[] }
export type HiveProviderQueue = { providers: Alveolus[] }
export type HiveQueue = HiveDemanderQueue | HiveProviderQueue

export class Hive {
	private constructor(public readonly board: HexBoard) {}
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
		this.onAddAlveolus(alveolus)
		this.pokeAlveolus(alveolus)
	}
	/**
	 * This hive is defined as a copy of another hive after an alveolus removal didn't divide it
	 * @param hive
	 */
	private copyFrom(hive: Hive) {
		if (hive.name) this.name = hive.name
		this.needs = hive.needs
	}
	/**
	 * This hive is defined as a part of another hive who had just been divided by an alveolus removal
	 * @param hive
	 */
	private partOf(hive: Hive) {
		if (hive.name) this.name = `${hive.name} - ${Math.random().toString(36).substring(2, 5)}`
		this.needs = {}
		for (const [goodType, alveoli] of Object.entries(hive.needs)) {
			const mySet = new Set<Alveolus>()
			for (const alveolus of alveoli) if (alveolus.hive === this) mySet.add(alveolus)
			if (mySet.size > 0) this.needs[goodType as GoodType] = mySet
		}
	}
	/**
	 * Has to be called *after* tile.content is not a alveolus anymore
	 * @param alveolus
	 */
	removeAlveolus(alveolus: Alveolus) {
		this.alveoli.delete(alveolus)
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
	getNeighborsForGood(ref: AxialRef, _goodType: GoodType) {
		const coord = axial.access(ref)
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
	needs: Partial<Record<GoodType, Set<Alveolus>>> = {}
	movingGoods = new AxialKeyMap<MovingGood[]>()
	storageAt(coord: AxialRef) {
		if (isTileCoord(axial.access(coord))) {
			const content = this.board.getTileContent(coord) as Alveolus
			return content
		}
		const border = this.board.getBorder(coord)!
		return border.content
	}
	private getQueue(goodType: GoodType) {
		return this.queues.get(goodType)
	}

	private clearQueueIfEmpty(goodType: GoodType) {
		const q = this.queues.get(goodType)
		if (q && 'demanders' in q && q.demanders.length === 0) this.queues.delete(goodType)
		if (q && 'providers' in q && q.providers.length === 0) this.queues.delete(goodType)
	}

	private createMovement(goodType: GoodType, provider: Alveolus, demander: Alveolus) {
		const positions = {
			provider: toAxialCoord(provider.tile.position),
			demander: toAxialCoord(demander.tile.position),
		}
		const { movingGoods } = this
		const path = findPath(
			(c) => this.getNeighborsForGood(c, goodType).map((n) => toAxialCoord(n)),
			positions.provider,
			positions.demander,
			Number.POSITIVE_INFINITY,
			true,
		)
		if (!path || path.length < 1) return false
		path.shift()	// remove the start as we know it
		const reason = {
			type: 'hive-transfer',
			goodType,
			...positions,
		}
		const providerToken = provider.reserve(goodType, 1, reason)
		const demanderToken = demander.allocate(goodType, 1, reason)
		let from = positions.provider
		let list = this.movingGoods.get(from) ?? []
		function removeFromList(good: MovingGood) {
			list.splice(list.indexOf(good), 1)
			if(list.length === 0) movingGoods.delete(from)
		}
		const movingGood: MovingGood = {
			goodType,
			path,
			provider,
			demander,
			allocations: {
				provider: providerToken,
				demander: demanderToken,
			},
			hop() {
				const rv = path.shift()!
				removeFromList(movingGood)
				if(movingGood.path.length) {
					from = rv
					if(!movingGoods.get(rv)) movingGoods.set(rv, [])
					list = movingGoods.get(rv)!
					list.push(movingGood)
				}
				return rv
			},
			finish() {
				removeFromList(movingGood)
			}
		}
		list.push(movingGood)
		movingGoods.set(from, list)
		return true
	}

	provide(goodType: GoodType, provider: Alveolus) {
		const q = this.getQueue(goodType)
		if (!q) return this.queues.set(goodType, { providers: [provider] })
		if ('providers' in q) {
			if (!q.providers.includes(provider)) q.providers.push(provider)
			return
		}
		// q.kind === 'demand' -> match fifo
		const demander = q.demanders.shift()
		if (demander) {
			this.createMovement(goodType, provider, demander)
			this.pokeAlveolus(demander)
		}
		this.clearQueueIfEmpty(goodType)
	}

	need(goodType: GoodType, demander: Alveolus) {
		const q = this.getQueue(goodType)
		this.needs[goodType] ??= new Set()
		this.needs[goodType]!.add(demander)
		if (!q) return this.queues.set(goodType, { demanders: [demander] })
		if ('demanders' in q) {
			if (!q.demanders.includes(demander)) q.demanders.push(demander)
			return
		}
		// q.kind === 'provide' -> match fifo
		const provider = q.providers.shift()
		if (provider) {
			this.createMovement(goodType, provider, demander)
			this.pokeAlveolus(provider)
		}
		this.clearQueueIfEmpty(goodType)
	}

	public pokeAlveolus(alveolus: Alveolus) {
		// Advertise needs (inputs) and provides (outputs) agnostic of action.type
		const action = alveolus.action as any
		if ('inputs' in action)
			for (const [gt] of Object.entries(action.inputs))
				if (alveolus.hasRoom(gt as GoodType) > 0) this.need(gt as GoodType, alveolus)
		if ('output' in action)
			for (const [gt] of Object.entries(action.output))
				if (alveolus.available(gt as GoodType) > 0) this.provide(gt as GoodType, alveolus)
	}
	//#endregion
	onAddAlveolus(_alveolus: Alveolus) {}
}
