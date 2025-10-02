import { maxWalkTime } from '$assets/constants'
import { goods as goodsCatalog } from '$assets/game-content'
import { contract, GoodType } from '$lib/arktype'
import type { Character } from '$lib/game/population/character'
import { type AxialCoord, type AxialRef, axial } from '$lib/utils'
import { Positioned, toAxialCoord } from '../../../utils/position'
import { UnBuiltLand } from '../../board/content/unbuilt-land'
import type { Tile } from '../../board/tile'
import { subject } from '../scripts'

class FindFunctions {
	declare [subject]: Character
	@contract(Positioned, 'boolean')
	path(to: Positioned, punctual: boolean = true) {
		return this[subject].game.hex.findPathForCharacter(
			toAxialCoord(this[subject].tile.position),
			axial.round(toAxialCoord(to)),
			this[subject],
			maxWalkTime,
			punctual,
		)
	}
	@contract()
	food() {
		const { hex } = this[subject].game
		function bestFoodOnTile(coord: AxialRef): GoodType | null {
			const tile = hex.getTile(coord)
			if (!tile) return null

			let best: { type: GoodType; fv: number } | null = null

			// Check storage goods first (existing behavior)
			const goodsMap = tile.content!.storage?.stock || {}
			for (const [good] of Object.entries(goodsMap) as [GoodType, number][]) {
				if (!tile.content!.storage?.available(good)) continue
				const def = goodsCatalog[good]
				if (!def) continue
				const fv = 'feedingValue' in def ? def.feedingValue : 0
				if (fv > 0 && (!best || fv > best.fv)) best = { type: good, fv }
			}

			// Check free goods on the ground (new behavior)
			const freeGoods = hex.freeGoods.getGoodsAt(axial.access(coord))
			for (const freeGood of freeGoods) {
				// Skip allocated or removed goods
				if (freeGood.allocated || freeGood.removed) continue
				const def = goodsCatalog[freeGood.goodType]
				if (!def) continue
				const fv = 'feedingValue' in def ? def.feedingValue : 0
				if (fv > 0 && (!best || fv > best.fv)) best = { type: freeGood.goodType, fv }
			}

			return best?.type ?? null
		}
		const start = toAxialCoord(this[subject].tile.position)
		const path = hex.findNearestForCharacter(
			start,
			this[subject],
			(coord) => bestFoodOnTile(coord) !== null,
			maxWalkTime,
			true,
		)
		if (!path || path.length === 0) return false as const
		const targetCoord = path[path.length - 1]
		const targetTile = hex.getTile(targetCoord)!
		const good = bestFoodOnTile(targetCoord)!
		return { tile: targetTile, good, path }
	}
	@contract('string')
	deposit(deposit: string) {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
		const path = hex.findNearestForCharacter(
			start,
			this[subject],
			(coord) => {
				const tile = hex.getTile(coord)
				return tile?.content instanceof UnBuiltLand && tile.content.deposit?.name === deposit
			},
			maxWalkTime,
			false,
		)
		if (!path || path.length === 0) return false as const
		return path
	}
	@contract(GoodType)
	freeSpot(goodType: GoodType) {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
		let qty = 0
		const path = hex.findNearestForCharacter(
			start,
			this[subject],
			(coord) => {
				const tile = hex.getTile(coord)
				if (!tile) return false
				qty = tile.content!.storage?.hasRoom(goodType) || 0
				return qty > 0
			},
			maxWalkTime,
			true,
		)
		if (!path || path.length === 0) return false as const
		const targetCoord = path[path.length - 1]
		const targetTile = hex.getTile(targetCoord)!
		return { tile: targetTile, path, qty }
	}

	@contract()
	randomPositionInTile() {
		const tile = this[subject].tile

		// Generate a random position within the current tile
		// Using a simple approach: generate random offset from tile center
		const tileCoord = toAxialCoord(tile.position)
		// Generate random point using triangular distribution
		const u = Math.random()
		const v = Math.random()

		const q = (u - v) * 0.5
		const r = v - 0.5

		return {
			q: tileCoord.q + q,
			r: tileCoord.r + r,
		}
	}
	@contract()
	wanderingTile() {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
		const distance = 2 + Math.random() * 3 // 2-5 tiles away

		// Find all walkable tiles within the distance range
		const walkableTiles: { coord: AxialCoord; tile: Tile }[] = []

		for (let q = -Math.ceil(distance); q <= Math.ceil(distance); q++) {
			for (let r = -Math.ceil(distance); r <= Math.ceil(distance); r++) {
				const coord = axial.linear({ q, r }, start)
				const actualDistance = axial.distance(start, coord)
				if (actualDistance >= 2) {
					const tile = hex.getTile(coord)
					if (tile && Number.isFinite(tile.content!.walkTime)) {
						walkableTiles.push({ coord, tile })
					}
				}
			}
		}

		if (walkableTiles.length === 0) return false

		// Pick a random walkable tile
		const randomIndex = Math.floor(Math.random() * walkableTiles.length)
		const { coord: targetCoord, tile: targetTile } = walkableTiles[randomIndex]

		return {
			tile: targetTile,
			path: this[subject].game.hex.findPathForCharacter(
				toAxialCoord(this[subject].tile.position),
				targetCoord,
				this[subject],
				maxWalkTime,
				true,
			),
		}
	}
}

export { FindFunctions }
