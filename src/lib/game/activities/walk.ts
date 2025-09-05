import type { AxialCoord, WorldCoord } from "$lib/hex"
import type { Character } from "../character"
import { HexTile } from "../hexboard"
import type { Plan } from "./manager"

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
					character.coord = hex.world2axial(e)
				},
			)
		}

		let position = character.position
		const center = hex.axial2world(character.coord)
		let tile = hex.getTile(character.coord)
		if (!tile)
			throw new Error(`No tile at character position ${character.coord.q}, ${character.coord.r}`)

		const distanceToCenter = Math.sqrt((position.x - center.x) ** 2 + (position.y - center.y) ** 2)
		if (distanceToCenter > 0.1) await walkTile(center, tile.walkTime)

		while (!(character.coord.q === coord.q && character.coord.r === coord.r)) {
			const path = hex.findPath(character.coord, coord, 100) // maxTime of 100
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

			log(
				`at ${character.coord.q}, ${character.coord.r} going to ${next.q}, ${next.r} for ${coord.q}, ${coord.r}`,
			)
			await walkTile(mid, tile.walkTime)
			tile = nextTile
			log(`reached mid ${tile.coord.q}, ${tile.coord.r}`)
			await walkTile(tile.position, tile.walkTime)
			character.coord = next
			position = hex.axial2world(next)
			if (reevaluate && !reevaluate()) return
		}
		log(`arrived at ${character.coord.q}, ${character.coord.r}`)
	}, customDescription || `Walking to ${coord.q}, ${coord.r}`)
}

export async function goForGoods(plan: Plan<Character>, target: HexTile, goods: string) {
	await goTo(plan, target, `Go grab ${goods}`, () => {
		return target.hasGood(goods)
	})
}

// #endregion
// #region Goods mgt

const transfer_duration = 0.5
export async function grab(plan: Plan<Character>, goods: string, maxAmount: number) {
	return plan(async function grab({ activated: character, lerpStep }) {
		const tile = character.game.hex.getTile(character.coord)
		if (!tile) throw new Error(`No tile at character position`)
		if (
			character.carried_goods &&
			character.carried_goods !== goods &&
			character.carried_amount > 0
		)
			return
		const can_grab = character.carrying_capacity - (character.carried_amount || 0)
		const amount = Math.min(can_grab, maxAmount)
		if (amount <= 0) return
		tile.takeGoods(goods, amount)
		await lerpStep(amount * transfer_duration, () => {})
		character.carried_goods = goods
		character.carried_amount = (character.carried_amount || 0) + amount
	}, `Grabbing ${goods}`)
}
export async function drop(plan: Plan<Character>, goods: string, max_amount: number) {
	return plan(async function drop({ activated: character, lerpStep }) {
		const tile = character.game.hex.getTile(character.coord)
		if (!tile) throw new Error(`No tile at character position`)
		if (character.carried_goods !== goods) return
		const amount = Math.min(character.carried_amount, max_amount)
		const dropped = tile.storeGoods(goods, amount)
		character.carried_amount -= dropped
		if (character.carried_amount <= 0) character.carried_goods = ""
		await lerpStep(amount * transfer_duration, () => {})
	}, `Dropping ${goods}`)
}

export function dropAllGoods(plan: Plan<Character>) {
	return plan(async ({ activated: character }) => {
		const world = character.game.hex
		const tile = world.getTile(character.coord)
		if (!tile) throw new Error(`No tile at character position`)
		while (character.carried_amount > 0) {
			while (!tile.canStoreGoods(character.carried_goods)) {
				// Find nearest tile that can store the goods
				const nearestTile = world.findNearest(
					character.coord,
					(coord) => {
						const t = world.getTile(coord)
						return t ? t.canStoreGoods(character.carried_goods) : false
					},
					10, // maxTime
				)
				if (!nearestTile || nearestTile.length === 0)
					throw new Error(`TODO: We have nowhere to drop what we have in hand, what to do?`)
				const targetTile = world.getTile(nearestTile[nearestTile.length - 1])
				if (!targetTile) throw new Error(`Target tile not found`)
				await goTo(plan, targetTile, `Go to drop ${character.carried_goods}`, () =>
					targetTile.canStoreGoods(character.carried_goods),
				)
			}
			const stored = tile.storeGoods(character.carried_goods, character.carried_amount)
			character.carried_amount -= stored
		}
	}, "Freeing hands")
}

