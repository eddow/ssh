import type { Position } from '../position'
import { lerp } from './scripts'

//#region Abstracts

export abstract class ASingleStep {
	abstract tick(dt: number): number | undefined
	abstract readonly description: string
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
	readonly description = 'Stepping'
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

//#endregion
