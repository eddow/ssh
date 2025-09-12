/*
type Application = { character: Character }
type Activity<State = any> = (application: Application, state: State) => any

type Sequence<State = any> = Activity<State>[]

type Grab = { goods: GoodType, maxAmount: number }

export const grab: Sequence<Grab> = [
	({ character }: Application, { goods, maxAmount }: Grab) => {
		if (
			character.carriedType &&
			character.carriedType !== goods &&
			character.carriedAmount > 0
		)
		return 'dropAllGoods'
	}
]*/

/*
export async function grab(plan: Plan<Character>, goods: GoodType, maxAmount: number) {
	return plan(async function grab({ activated: character, lerpStep }) {
		const tile = character.game.hex.getTile(character.coord)
		if (!tile) throw new Error(`No tile at character position`)
		if (
			character.carriedType &&
			character.carriedType !== goods &&
			character.carriedAmount > 0
		)
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
}*/
