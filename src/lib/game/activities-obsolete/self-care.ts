// #region Eat

import { goods as goodsCatalog } from '$assets/game-content'
import type { GoodType, Module } from '$lib/game/tile'
import type { AxialRef } from '$lib/hex'
import type { Character } from '../character'
import type { Plan } from './manager'
import { dropAllGoods, goForGoods, goTo, grab } from './walk'

const eatingTime = 3

export function goEat(plan: Plan<Character>) {
	return plan(async ({ activated: character, lerpStep }) => {
		const { hex } = character.game

		function carryFood() {
			if (!character.carriedType || character.carriedAmount <= 0) return false
			const def = goodsCatalog[character.carriedType]
			return def && def.feedingValue > 0 ? character.carriedType : false
		}

		function eatFood(foodType: GoodType) {
			const feedingValue = goodsCatalog[foodType]?.feedingValue ?? 0
			const effective = Math.max(0, Math.min(feedingValue, character.hunger))
			const part = feedingValue > 0 ? effective / feedingValue : 0
			const from = character.hunger
			const to = Math.max(0, from - effective)
			return lerpStep(
				{
					duration: eatingTime * part,
					from,
					to,
				},
				function eating(e) {
					character.hunger = e
				},
				`Chewing ${foodType}`,
			)
		}

		function bestFoodOnTile(coord: AxialRef): GoodType | null {
			const tile = hex.getTile(coord)
			if (!tile) return null
			const goodsMap = tile.content.listGoods()
			let best: { type: GoodType; fv: number } | null = null
			for (const [good, count] of Object.entries(goodsMap) as [GoodType, number][]) {
				if (!count) continue
				const def = goodsCatalog[good]
				if (!def) continue
				const fv = def.feedingValue ?? 0
				if (fv > 0 && (!best || fv > best.fv)) best = { type: good, fv }
			}
			return best?.type ?? null
		}

		if (character.carriedAmount > 0 && !carryFood()) await dropAllGoods(plan)
		while (character.hunger > character.triggerLevels.hunger.satisfied) {
			let carrying: GoodType | false
			while (!(carrying = carryFood())) {
				// Find nearest tile with food
				const nearestFoodTile = hex.findNearest(
					character.coord,
					(coord) => bestFoodOnTile(coord) !== null,
					100, // maxTime
				)
				if (!nearestFoodTile || nearestFoodTile.length === 0) {
					throw new Error('No food source found within range')
				}
				const targetTile = hex.getTile(nearestFoodTile[nearestFoodTile.length - 1])
				if (!targetTile) throw new Error('Target tile not found')

				// Pick best available food on the target tile
				let foodType = bestFoodOnTile(targetTile.coord)

				while (
					foodType &&
					!(character.coord.q === targetTile.coord.q && character.coord.r === targetTile.coord.r)
				) {
					await goForGoods(plan, targetTile, foodType as GoodType)
					const currentTile = hex.getTile(character.coord)
					if (!currentTile) throw new Error('No tile at character position')
					foodType = bestFoodOnTile(currentTile.coord)
					if (!foodType) {
						// Find new food source
						const newNearestFoodTile = hex.findNearest(
							character.coord,
							(coord) => bestFoodOnTile(coord) !== null,
							100,
						)
						if (!newNearestFoodTile || newNearestFoodTile.length === 0) {
							throw new Error('No food source found within range')
						}
						const newTargetTile = hex.getTile(newNearestFoodTile[newNearestFoodTile.length - 1])
						if (!newTargetTile) throw new Error('Target tile not found')
						foodType = bestFoodOnTile(newTargetTile.coord)
					}
				}
				if (foodType) await grab(plan, foodType as GoodType, 1)
				else throw new Error('TODO: No food found within range')
			}
			character.carriedAmount--
			await eatFood(carrying!)
		}
	}, 'Feeding')
}

export function goRest(plan: Plan<Character>) {
	return plan(async ({ activated: character, evolveStep }) => {
		if (!character.assignedModule) {
			throw new Error('Not working')
		}
		// Find the tile that contains the assigned building
		const buildingTile = character.game.hex.findNearest(
			character.coord,
			(coord) => {
				const tile = character.game.hex.getTile(coord)
				return tile ? tile.content === (character.assignedModule as unknown as Module) : false
			},
			100,
		)
		if (!buildingTile || buildingTile.length === 0) {
			throw new Error('Assigned building not found')
		}
		const targetTile = character.game.hex.getTile(buildingTile[buildingTile.length - 1])
		if (!targetTile) throw new Error('Target tile not found')
		await goTo(plan, targetTile, 'Going to workplace')

		await evolveStep(
			{
				get value() {
					return character.fatigue
				},
				set value(v) {
					character.fatigue = v
				},
				factor: -10, // Default rest ease - should come from building definition
				bound: 0,
			},
			'resting',
			'Preparing for work',
		)
	}, 'Going to rest')
}

export function goSleep(plan: Plan<Character>) {
	return plan(async ({ activated: character, evolveStep }) => {
		await evolveStep(
			{
				get value() {
					return character.Tiredness
				},
				set value(v) {
					character.Tiredness = v
				},
				factor: -50,
				bound: 0,
			},
			'sleeping',
		)
	}, 'Going to sleep')
}
