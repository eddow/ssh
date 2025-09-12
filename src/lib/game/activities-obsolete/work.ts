/*import { dropAllGoods, goTo, grab } from "./walk"
import type { Plan } from "./manager"

export function goWork(plan: Plan) {
	return plan(async function work({ character, workPlace, idle }) {
		if (!workPlace) throw new Error("Not working")

		const actions = workPlace.get_available_actions()
		if (actions.length === 0) return idle(1, "No work available")
		const action = workPlace.select_weighted_action(actions)
		if (!action) return idle(1, "No work available")

		switch (action.type) {
			case "harvesting":
				await goHarvest(plan, action)
				break
			/*case 'transformation':
				await goTransform(plan, action)
				break* /
		}
	})
}

export async function goHarvest(plan: Plan, action: HarvestingAction) {
	return plan(async function goHarvest({ character, log, deposits, idle }) {
		const { deposit: depositType, output, time: harvestTime } = action
		const { display_name: depositName } = deposits.get_definition(depositType)
		const deposit = character.find_nearest_available_deposit(depositType)
		if (!deposit) return log(`No ${depositName} found`)

		try {
			await dropAllGoods(plan)
			log(`moving to harvest ${depositName}`)
			await goTo(plan, deposit, `Going to harvest ${depositName}`)
			await idle(harvestTime, `Harvesting ${depositName}`, `working`)
			// TODO: multi-output
			const [goods, amount] = Object.entries(output)[0]
			deposit.harvest_deposit()
			character.carried_goods = goods
			character.carried_amount = amount
		} finally {
			deposits.release(deposit)
		}
	})
}
*/
