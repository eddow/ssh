import type { Character } from '../character'
import type { Position } from '../position'
import type { GoodType } from '../tile'
import { lerp } from './scripts'

//#region Abstracts
export type ActivityType =
	| 'idle'
	| 'walk'
	| 'work'
	| 'fun'
	| 'eat'
	| 'sleep'
	| 'rest'
	| 'grab'
	| 'drop'

export abstract class ASingleStep {
	abstract tick(dt: number): number | undefined
	abstract readonly type: ActivityType
}

export abstract class AEvolutionStep extends ASingleStep {
	constructor(public readonly duration: number) {
		super()
	}
	evolution = 0
	abstract evolve(evolution: number): void
	finish(): void {}
	tick(dt: number): number | undefined {
		this.evolution += dt / this.duration
		if (this.evolution >= 1) {
			this.evolve(1)
			this.finish()
			return (this.evolution - 1) * this.duration
		} else this.evolve(this.evolution)
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

const transferDuration = 0.5

export class GrabStep extends AEvolutionStep {
	get type() {
		return 'grab' as const
	}
	constructor(
		readonly character: Character,
		readonly goodType: GoodType,
		readonly maxAmount: number,
	) {
		super(maxAmount * transferDuration)
	}

	evolve(evolution: number): void {
		// Grab logic is handled in finish() to ensure it happens once
	}

	finish(): void {
		const tile = this.character.tile

		// Check if we need to drop current goods first
		if (
			this.character.carriedType &&
			this.character.carriedType !== this.goodType &&
			this.character.carriedAmount > 0
		) {
			// Drop all current goods
			while (this.character.carriedAmount > 0) {
				const dropped = tile.content.addGood(
					this.character.carriedType,
					this.character.carriedAmount,
				)
				this.character.carriedAmount -= dropped
				if (this.character.carriedAmount <= 0) {
					this.character.carriedType = undefined
					break
				}
			}
		}

		const canGrab = this.character.carryingCapacity - (this.character.carriedAmount || 0)
		const amount = Math.min(canGrab, this.maxAmount)
		if (amount <= 0) return

		const taken = tile.content.removeGood(this.goodType, amount)
		if (taken <= 0) return

		this.character.carriedType = this.goodType
		this.character.carriedAmount = (this.character.carriedAmount || 0) + taken
	}
}

export class DropStep extends AEvolutionStep {
	get type() {
		return 'drop' as const
	}
	constructor(
		readonly character: Character,
		readonly goodType: GoodType,
		readonly maxAmount: number,
	) {
		super(maxAmount * transferDuration)
	}

	evolve(evolution: number): void {
		// Drop logic is handled in finish() to ensure it happens once
	}

	finish(): void {
		const tile = this.character.tile

		if (this.character.carriedType !== this.goodType) return

		const amount = Math.min(this.character.carriedAmount, this.maxAmount)
		const dropped = tile.content.addGood(this.goodType, amount)
		this.character.carriedAmount -= dropped
		if (this.character.carriedAmount <= 0) {
			this.character.carriedType = undefined
		}
	}
}

//#endregion
