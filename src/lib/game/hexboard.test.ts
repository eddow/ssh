import { describe, it, expect } from 'vitest'
import { HexBoard, TerrainType } from "./hexboard"

describe('HexBoard', () => {
	it('should create a board with correct size', () => {
		const board = new HexBoard(256)
		expect(board.getSize()).toBe(256)
	})

	it('should generate tiles within bounds', () => {
		const board = new HexBoard(10)
		expect(board.getTileCount()).toBeGreaterThan(0)
		
		// Check that center tile exists
		const centerTile = board.getTile({ q: 0, r: 0 })
		expect(centerTile).toBeDefined()
		expect(centerTile?.terrain).toBeDefined()
	})

	it('should have all terrain types', () => {
		const board = new HexBoard(20)
		
		const waterTiles = board.getTilesByTerrain(TerrainType.WATER)
		const grassTiles = board.getTilesByTerrain(TerrainType.GRASS)
		const forestTiles = board.getTilesByTerrain(TerrainType.FOREST)
		const rockyTiles = board.getTilesByTerrain(TerrainType.ROCKY)
		
		expect(waterTiles.length).toBeGreaterThan(0)
		expect(grassTiles.length).toBeGreaterThan(0)
		expect(forestTiles.length).toBeGreaterThan(0)
		expect(rockyTiles.length).toBeGreaterThan(0)
	})

	it('should have correct neighbor count', () => {
		const board = new HexBoard(10)
		const neighbors = board.getNeighbors({ q: 0, r: 0 })
		expect(neighbors.length).toBe(6) // Hexagons always have 6 neighbors
	})

	it('should correctly check bounds', () => {
		const board = new HexBoard(10)
		
		// Center should be within bounds
		expect(board.isWithinBounds({ q: 0, r: 0 })).toBe(true)
		
		// Far away should be out of bounds
		expect(board.isWithinBounds({ q: 300, r: 300 })).toBe(false)
	})

	it('should allow setting and getting tiles', () => {
		const board = new HexBoard(10)
		const coord = { q: 1, r: 1 }
		const customTile = { terrain: TerrainType.WATER }
		
		board.setTile(coord, customTile)
		const retrievedTile = board.getTile(coord)
		
		expect(retrievedTile).toEqual(customTile)
	})

	it('should iterate through all tiles', () => {
		const board = new HexBoard(5)
		let tileCount = 0
		
		for (const [coord, tile] of board.getAllTiles()) {
			expect(coord).toHaveProperty('q')
			expect(coord).toHaveProperty('r')
			expect(tile).toHaveProperty('terrain')
			tileCount++
		}
		
		expect(tileCount).toBe(board.getTileCount())
	})
})
