import { Eventful } from 'mutts'
import { activityDurations, ponderingFatigueRecovery } from '$assets/constants'
import { goods as goodsCatalog } from '$assets/game-content'
import type { Character } from '../character'
import type { Position } from '../position'
import type { GoodType } from '../tile'
import { type AsyncActionEvents, lerp } from './scripts'

//#region Abstracts

export abstract class ASingleStep extends Eventful<AsyncActionEvents> {
	abstract tick(dt: number): number | undefined
	cancel() {
		this.emit('cancel')
	}
	finish(): void {
		this.emit('finish')
	}
	abstract readonly type: Ssh.ActivityType
}

export abstract class AEvolutionStep extends ASingleStep {
	constructor(public readonly duration: number) {
		super()
	}
	evolution = 0
	evolve(_evolution: number, _dt: number): void {}
	tick(dt: number): number | undefined {
		this.evolution += dt / this.duration
		if (this.evolution >= 1) {
			this.evolve(1, this.evolution - 1)
			this.finish()
			return (this.evolution - 1) * this.duration
		} else this.evolve(this.evolution, dt / this.duration)
	}
}

export abstract class ALerpStep<T extends number | Position> extends AEvolutionStep {
	constructor(
		duration: number,
		public readonly from: T,
		public readonly to: T,
	) {
		super(duration)
	}
	abstract lerp(value: T): void
	evolve(evolution: number): void {
		this.lerp(lerp(this.from, this.to, evolution))
	}
}

//#endregion
//#region Commons

export class MoveToStep extends ALerpStep<Position> {
	get type() {
		return 'walk' as const
	}
	constructor(
		duration: number,
		readonly who: { position: Position },
		to: Position,
	) {
		super(duration, who.position, to)
	}
	lerp(position: Position): void {
		this.who.position = position
	}
}

export class GrabStep extends AEvolutionStep {
	get type() {
		return 'grab' as const
	}
	constructor(character: Character, goodType: GoodType, maxAmount: number) {
		const tile = character.tile

		// Check if we need to drop current goods first
		if (
			character.carriedType &&
			character.carriedType !== goodType &&
			character.carriedAmount > 0
		) {
			// Drop all current goods
			const dropped = tile.content.addGood(character.carriedType, character.carriedAmount)
			character.carriedAmount -= dropped
			if (character.carriedAmount <= 0) character.carriedType = undefined
		}

		const canGrab = character.carryingCapacity - (character.carriedAmount || 0)
		const amount = Math.min(canGrab, maxAmount)

		const taken = amount <= 0 ? 0 : tile.content.removeGood(goodType, amount)
		if (taken > 0) {
			character.carriedType = goodType
			character.carriedAmount = (character.carriedAmount || 0) + taken
		}
		super(taken * activityDurations.transfer)
	}
}

export class DropStep extends AEvolutionStep {
	get type() {
		return 'drop' as const
	}
	constructor(character: Character, goodType: GoodType, maxAmount: number) {
		const tile = character.tile

		const amount = Math.min(character.carriedAmount, maxAmount)
		const dropped = tile.content.addGood(goodType, amount)
		character.carriedAmount -= dropped
		if (character.carriedAmount <= 0) character.carriedType = undefined
		super(amount * activityDurations.transfer)
	}

	finish(): void {}
}
export class EatStep extends AEvolutionStep {
	get type() {
		return 'eat' as const
	}
	private readonly feedingValue: number
	constructor(readonly character: Character) {
		super(activityDurations.eating)
		this.feedingValue = goodsCatalog[character.carriedType!]?.feedingValue ?? 0
		if (this.feedingValue) {
			--this.character.carriedAmount

			if (this.character.carriedAmount <= 0) this.character.carriedType = undefined
		}
	}
	evolve(_: number, dt: number): void {
		this.character.hunger = Math.max(0, this.character.hunger - this.feedingValue * dt)
	}
}

//#endregion

//#region PonderingStep
export class PonderingStep extends AEvolutionStep {
	get type() {
		return 'rest' as const
	}
	evolve(_: number, dt: number): void {
		this.character.fatigue = Math.max(0, this.character.fatigue - ponderingFatigueRecovery * dt)
	}
	constructor(
		readonly character: Character,
		duration: number = lerp(activityDurations.restMin, activityDurations.restMax, Math.random()),
	) {
		super(duration)
	}
}
//#endregion
