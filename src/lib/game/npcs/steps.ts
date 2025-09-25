import { activityDurations, ponderingFatigueRecovery } from '$assets/constants'
import { goods as goodsCatalog } from '$assets/game-content'
import type { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { casing } from '$lib/utils'
import type { Character } from '../population'
import type { Position, Positioned } from '../position'
import { Finalized } from './scripts'
import { lerp } from './utils'

//#region Abstracts

export abstract class ASingleStep extends Finalized {
	get description(): string | false {
		return casing(this.constructor.name).transform((terms) => {
			const lastTerm = terms.pop()
			assert(lastTerm === 'Step', 'Last term of step constructor name is not Step')
		}).kebab
	}

	abstract tick(dt: number): number | undefined
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

export abstract class ALerpStep<T extends number | Positioned> extends AEvolutionStep {
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
export class MoveToStep extends ALerpStep<Positioned> {
	get description(): string | false {
		return this.givenDescription ?? super.description
	}
	constructor(
		duration: number,
		readonly who: { position: Position },
		to: Positioned,
		readonly type: Ssh.ActivityType = 'walk',
		readonly givenDescription?: string,
	) {
		super(duration, who.position, to)
	}
	lerp(position: Position): void {
		this.who.position = position
	}
}

export class WaitStep extends AEvolutionStep {
	get description(): string | false {
		return this.givenDescription
	}
	constructor(
		duration: number,
		readonly type: Ssh.ActivityType,
		readonly givenDescription: string,
	) {
		super(duration)
	}
}

//#endregion
//#region self-care
export class EatStep extends AEvolutionStep {
	get type() {
		return 'eat' as const
	}
	private readonly feedingValue: number
	constructor(
		readonly character: Character,
		readonly food: GoodType,
	) {
		super(activityDurations.eating)
		this.feedingValue = goodsCatalog[food].feedingValue
		assert(this.character.vehicle.removeGood(food, 1) === 1, "Didn't have food he is trying to eat")
	}
	evolve(_: number, dt: number): void {
		this.character.hunger = Math.max(0, this.character.hunger - this.feedingValue * dt)
	}
}

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
