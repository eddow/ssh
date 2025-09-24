import { computed, ReactiveBase, reactive } from 'mutts'
import type { GoodType } from '$lib/arktype'
import { type AxialCoord, type AxialRef, axial, findNearest } from '$lib/hex'
import { AxialKeyMap } from '$lib/mem'
import { setPop } from '$lib/utils'
import { type HexBoard, isTileCoord } from '../board/board'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
import { toAxialCoord } from '../position'
export interface MovingGood {
	goodType: GoodType
	path: AxialCoord[]
}

@reactive
export class Hive extends ReactiveBase {
	private constructor(public readonly board: HexBoard) {
		super()
	}
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
	}
	private copyFrom(hive: Hive) {
		if (hive.name) this.name = hive.name
		this.needs = hive.needs
	}
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
	movingGoods = new AxialKeyMap<MovingGood>()
	storageAt(coord: AxialRef) {
		if (isTileCoord(axial.access(coord))) {
			const content = this.board.getTileContent(coord) as Alveolus
			return content
		}
		const border = this.board.getBorder(coord)!
		return border.content
	}
	demand(goodType: GoodType, alveolus: Alveolus) {
		// First, find the nearest alveolus that can provide this good
		const pullPath = findNearest(
			(c) => this.getNeighborsForGood(c, goodType).map((n) => toAxialCoord(n)),
			alveolus.position,
			(c) => this.storageAt(c)!.available(goodType) > 0,
			// The `stop` is implemented in the `neighbors` getter as we stay in a hive
			Number.POSITIVE_INFINITY,
		)
		debugger
	}
	//#endregion
	onAddAlveolus(_alveolus: Alveolus) {}
}
