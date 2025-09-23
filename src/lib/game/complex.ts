import type { GoodType } from '$lib/arktype'
import { type AxialCoord, type AxialRef, axial, findNearest } from '$lib/hex'
import { AxialKeyMap } from '$lib/mem'
import { setPop } from '$lib/utils'
import { type HexBoard, isTileCoord, type Tile } from './board'
import { Module } from './board/content/module/module'
import { toAxialCoord } from './position'

export interface MovingGood {
	goodType: GoodType
	path: AxialCoord[]
}

export class Complex {
	private constructor(public readonly board: HexBoard) {}
	//#region Complexes management on tile add/remove
	static for(tile: Tile) {
		const complexes = new Set<Complex>()
		for (const neighbor of tile.neighborTiles)
			if (neighbor?.content instanceof Module) complexes.add(neighbor.content.complex)
		if (complexes.size === 0) return new Complex(tile.board)
		if (complexes.size === 1) return setPop(complexes)!
		const complexesArray = Array.from(complexes)
		// TODO: ask which complex, or detail which configuration to keep in the ui
		const complex = complexesArray.shift()!
		for (const complex of complexesArray)
			for (const module of complex.modules) complex.attach(module)
		return complex
	}
	public name?: string
	public readonly modules = new Set<Module>()
	public attach(module: Module) {
		this.modules.add(module)
		module.complex = this
		this.onAddModule(module)
	}
	private copyFrom(complex: Complex) {
		if (complex.name) this.name = complex.name
		this.needs = complex.needs
	}
	private partOf(complex: Complex) {
		if (complex.name) this.name = `${complex.name} - ${Math.random().toString(36).substring(2, 5)}`
		this.needs = {}
		for (const [goodType, modules] of Object.entries(complex.needs)) {
			const mySet = new Set<Module>()
			for (const module of modules) if (module.complex === this) mySet.add(module)
			if (mySet.size > 0) this.needs[goodType as GoodType] = mySet
		}
	}
	/**
	 * Has to be called *after* tile.content is not a module anymore
	 * @param module
	 */
	removeModule(module: Module) {
		this.modules.delete(module)
		const toPlaceModules = new Set(this.modules)
		const complexes: Complex[] = []

		while (toPlaceModules.size > 0) {
			const complex = new Complex(this.board)
			complexes.push(complex)
			const toAddSet = new Set<Module>()
			toAddSet.add(setPop(toPlaceModules)!)
			while (toAddSet.size > 0) {
				const module = setPop(toAddSet)!
				complex.attach(module)
				for (const neighbor of module.neighborModules)
					if (!complex.modules.has(neighbor)) toAddSet.add(neighbor)
			}
		}
		if (complexes.length === 1) return complexes[0].copyFrom(this)
		for (let i = 0; i < complexes.length - 1; i++) complexes[i].partOf(this)
	}
	//#endregion
	getNeighborsForGood(ref: AxialRef, _goodType: GoodType) {
		const coord = axial.access(ref)
		if (isTileCoord(coord)) {
			const content = this.board.getTileContent(ref) as Module
			return content.gates.map((g) => g.border.position)
		}
		// Get a border's neighbors - find tileA's and tileB's borders who are gates but not me
		const border = this.board.getBorder(ref)!
		function notMeGates(tile: Tile) {
			return tile.content instanceof Module && tile.content.conveyor ? [tile.position] : []
		}
		return [...notMeGates(border.tile.a), ...notMeGates(border.tile.b)]
	}
	//#region Needy / events
	needs: Partial<Record<GoodType, Set<Module>>> = {}
	movingGoods = new AxialKeyMap<MovingGood>()
	storageAt(coord: AxialRef) {
		if (isTileCoord(axial.access(coord))) {
			const content = this.board.getTileContent(coord) as Module
			return content
		}
		const border = this.board.getBorder(coord)!
		return border.content
	}
	demand(goodType: GoodType, module: Module) {
		// First, find the nearest module that can provide this good
		const pullPath = findNearest(
			(c) => this.getNeighborsForGood(c, goodType).map((n) => toAxialCoord(n)),
			module.position,
			(c) => this.storageAt(c)!.available(goodType) > 0,
			// The `stop` is implemented in the `neighbors` getter as we stay in a complex
			Number.POSITIVE_INFINITY,
		)
		debugger
	}
	//#endregion
	onAddModule(_module: Module) {}
}
