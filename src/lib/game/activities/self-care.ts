// #region Eat

import type { Character } from "../character"
import { dropAllGoods, goForGoods, goTo, grab } from "./walk"
import type { Plan } from "./manager"

const eatingTime = 3

export function goEat(plan: Plan<Character>) {
	return plan(async ({ activated: character, lerpStep }) => {
		const { hex } = character.game

		function carryFood() {
			if (!character.carriedType || character.carriedAmount <= 0) return false
			// For now, assume all carried goods are food - this should be enhanced with proper food definitions
			return character.carriedType
		}

		function eatFood(foodType: string) {
			const feedingValue = 100 // Default feeding value - should come from goods definition
			const part = Math.min(1, character.hunger / feedingValue)
			const from = character.hunger
			const to = Math.max(0, from - feedingValue)
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

		if (character.carriedAmount > 0 && !carryFood()) await dropAllGoods(plan)
		while (character.hunger > character.triggerLevels.hunger.satisfied) {
			let carrying: string | false
			while (!(carrying = carryFood())) {
				// Find nearest tile with food
				const nearestFoodTile = hex.findNearest(
					character.coord,
					(coord) => {
						const tile = hex.getTile(coord)
						// TODO: use `feedingValue`
						return tile ? tile.hasGood("berries") || tile.hasGood("mushrooms") : false
					},
					100, // maxTime
				)
				if (!nearestFoodTile || nearestFoodTile.length === 0) {
					throw new Error("No food source found within range")
				}
				const targetTile = hex.getTile(nearestFoodTile[nearestFoodTile.length - 1])
				if (!targetTile) throw new Error("Target tile not found")

				// Find what food is available
				let foodType = targetTile.hasGood("berries")
					? "berries"
					: targetTile.hasGood("mushrooms")
						? "mushrooms"
						: null

				while (
					foodType &&
					!(character.coord.q === targetTile.coord.q && character.coord.r === targetTile.coord.r)
				) {
					await goForGoods(plan, targetTile, foodType)
					const currentTile = hex.getTile(character.coord)
					if (!currentTile) throw new Error("No tile at character position")
					foodType = currentTile.hasGood("berries")
						? "berries"
						: currentTile.hasGood("mushrooms")
							? "mushrooms"
							: null
					if (!foodType) {
						// Find new food source
						const newNearestFoodTile = hex.findNearest(
							character.coord,
							(coord) => {
								const tile = hex.getTile(coord)
								return tile ? tile.hasGood("berries") || tile.hasGood("mushrooms") : false
							},
							100,
						)
						if (!newNearestFoodTile || newNearestFoodTile.length === 0) {
							throw new Error("No food source found within range")
						}
						const newTargetTile = hex.getTile(newNearestFoodTile[newNearestFoodTile.length - 1])
						if (!newTargetTile) throw new Error("Target tile not found")
						foodType = newTargetTile.hasGood("berries")
							? "berries"
							: newTargetTile.hasGood("mushrooms")
								? "mushrooms"
								: null
					}
				}
				if (foodType) await grab(plan, foodType, 1)
				else throw new Error("TODO: No food found within range")
			}
			character.carriedAmount--
			await eatFood(carrying!)
		}
	}, "Feeding")
}

export function goRest(plan: Plan<Character>) {
	return plan(async ({ activated: character, evolveStep }) => {
		if (!character.assignedModule) {
			throw new Error("Not working")
		}
		// Find the tile that contains the assigned building
		const buildingTile = character.game.hex.findNearest(
			character.coord,
			(coord) => {
				const tile = character.game.hex.getTile(coord)
				return tile ? tile.building === character.assignedModule : false
			},
			100,
		)
		if (!buildingTile || buildingTile.length === 0) {
			throw new Error("Assigned building not found")
		}
		const targetTile = character.game.hex.getTile(buildingTile[buildingTile.length - 1])
		if (!targetTile) throw new Error("Target tile not found")
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
			"resting",
			'Preparing for work'
		)
	}, "Going to rest")
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
			"sleeping",
		)
	}, "Going to sleep")
}
