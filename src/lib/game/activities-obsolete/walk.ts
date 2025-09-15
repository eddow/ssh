import type { AxialCoord, WorldCoord } from '$lib/hex'
import type { Character } from '../character'
import { HexTile } from '../hexboard'
import type { GoodType } from '../tile'
import type { Plan } from './manager'

export async function goTo(
	plan: Plan<Character>,
	target: HexTile | AxialCoord,
	customDescription?: string,
	reevaluate?: () => boolean,
) {
	const coord = target instanceof HexTile ? target.coord : target
	await plan(async ({ activated: character, lerpStep, log }) => {
		const { hex } = character.game

		const walkTile = (to: WorldCoord, walkTime: number) => {
			if (!Number.isFinite(walkTime)) throw new Error(`Cannot walk on ${to.x}, ${to.y}`)
			const from = character.position
			const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)
			const movementSpeed = 50 // Default movement speed (pixel/second)
			return lerpStep(
				{
					duration: (walkTime * distance) / movementSpeed,
					from,
					to,
				},
				function step(e) {
					character.position = hex.world2axial(e)
				},
			)
		}

		let position = character.position
		const center = hex.axial2world(character.position)
		let tile = hex.getTile(character.position)
		if (!tile)
			throw new Error(
				`No tile at character position ${character.position.q}, ${character.position.r}`,
			)

		const distanceToCenter = Math.sqrt((position.x - center.x) ** 2 + (position.y - center.y) ** 2)
		if (distanceToCenter > 0.1) await walkTile(center, tile.content.walkTime)

		while (!(character.position.q === coord.q && character.position.r === coord.r)) {
			const path = hex.findPath(character.position, coord, 100) // maxTime of 100
			if (!path || path.length === 0) {
				throw new Error(`No path found to ${coord.q}, ${coord.r}`)
			}
			const next = path[1] // Next step in path
			const nextTile = hex.getTile(next)
			if (!nextTile) throw new Error(`No tile at next position ${next.q}, ${next.r}`)

			const mid = {
				x: (position.x + nextTile.position.x) / 2,
				y: (position.y + nextTile.position.y) / 2,
			}

			/*log(
				`at ${character.coord.q}, ${character.coord.r} going to ${next.q}, ${next.r} for ${coord.q}, ${coord.r}`,
			)*/
			await walkTile(mid, tile.content.walkTime)
			tile = nextTile
			//log(`reached mid ${tile.coord.q}, ${tile.coord.r}`)
			await walkTile(tile.position, tile.content.walkTime)
			character.position = next
			position = hex.axial2world(next)
			if (reevaluate && !reevaluate()) return
		}
		log(`arrived at ${character.position.q}, ${character.position.r}`)
	}, customDescription || `Walking to ${coord.q}, ${coord.r}`)
}

export async function goForGoods(plan: Plan<Character>, target: HexTile, goods: GoodType) {
	await goTo(plan, target, `Go grab ${goods}`, () => {
		return !!target.content.listGoods()[goods]
	})
}

// #endregion
// #region Goods mgt

const transferDuration = 0.5
export async function grab(plan: Plan<Character>, goods: GoodType, maxAmount: number) {
	return plan(async function grab({ activated: character, lerpStep }) {
		const tile = character.game.hex.getTile(character.position)
		if (!tile) throw new Error(`No tile at character position`)
		if (character.carriedType && character.carriedType !== goods && character.carriedAmount > 0)
			await dropAllGoods(plan)
		const canGrab = character.carryingCapacity - (character.carriedAmount || 0)
		const amount = Math.min(canGrab, maxAmount)
		if (amount <= 0) return 0
		const taken = tile.content.removeGood(goods, amount)
		if (taken <= 0) return 0
		await lerpStep(taken * transferDuration, () => {})
		character.carriedType = goods
		character.carriedAmount = (character.carriedAmount || 0) + taken
		return taken
	}, `Grabbing ${goods}`)
}
export async function drop(plan: Plan<Character>, goods: GoodType, maxAmount: number) {
	return plan(async function drop({ activated: character, lerpStep }) {
		const tile = character.game.hex.getTile(character.position)
		if (!tile) throw new Error(`No tile at character position`)
		if (character.carriedType !== goods) return
		const amount = Math.min(character.carriedAmount, maxAmount)
		const dropped = tile.content.addGood(goods, amount)
		character.carriedAmount -= dropped
		if (character.carriedAmount <= 0) character.carriedType = undefined
		await lerpStep(amount * transferDuration, () => {})
	}, `Dropping ${goods}`)
}

export function dropAllGoods(plan: Plan<Character>) {
	return plan(async ({ activated: character }) => {
		const world = character.game.hex
		const tile = world.getTile(character.position)
		if (!tile) throw new Error(`No tile at character position`)
		while (character.carriedAmount > 0) {
			while (!tile.content.canStoreGood(character.carriedType!)) {
				// Find nearest tile that can store the goods
				const nearestTile = world.findNearest(
					character.position,
					(coord) => {
						const t = world.getTile(coord)
						return t ? !!t.content.canStoreGood(character.carriedType!) : false
					},
					10, // maxTime
				)
				if (!nearestTile || nearestTile.length === 0)
					throw new Error(`TODO: We have nowhere to drop what we have in hand, what to do?`)
				const targetTile = world.getTile(nearestTile[nearestTile.length - 1])
				if (!targetTile) throw new Error(`Target tile not found`)
				await goTo(
					plan,
					targetTile,
					`Go to drop ${character.carriedType}`,
					() => !!targetTile.content.canStoreGood(character.carriedType!),
				)
			}
			const stored = tile.content.addGood(character.carriedType!, character.carriedAmount)
			character.carriedAmount -= stored
		}
	}, 'Freeing hands')
}
