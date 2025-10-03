import { contract, type Goods, type GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import type { Character } from '$lib/game/population/character'
import type { AllocationBase } from '$lib/game/storage'
import { axial } from '$lib/utils'
import { AlveolusArkType } from '../../board'
import { UnBuiltLand } from '../../board/content/unbuilt-land'
import type { TransformAlveolus } from '../../hive/transform'
import { subject } from '../scripts'
import { DurationStep, MoveToStep, WaitForPredicateStep } from '../steps'

class WorkFunctions {
	declare [subject]: Character
	@contract()
	// TODO: specific cases for `convey`: preparationTime, assignedConveyor, ... ?
	prepare() {
		assert(
			this[subject].assignedAlveolus?.preparationTime,
			'assignedAlveolus must be set and have a preparationTime',
		)
		return new DurationStep(
			this[subject].assignedAlveolus!.preparationTime,
			'work',
			`prepare.${this[subject].assignedAlveolus!.name}`,
		)
	}
	@contract()
	waitForIncomingGoods() {
		return new WaitForPredicateStep(
			'wait for incoming goods',
			() => this[subject].assignedAlveolus!.goodMovements.length > 0,
		)
	}
	@contract(AlveolusArkType.optional())
	conveyStep() {
		const character = this[subject]
		const alveolus = character.assignedAlveolus!
		assert(
			alveolus === character.tile.content,
			'Character must be assigned to the alveolus on the same tile',
		)
		// Pick one movement that passes through this alveolus
		const movements = alveolus.goodMovements
		if (movements.length === 0) return
		const mg = movements[0]
		const hive = alveolus.hive

		mg.allocations.source.fulfill()
		// Advance one hop along the path
		const hop = mg.hop()!
		const nextStorage = hive.storageAt(hop)
		const hopAlloc =
			mg.path.length && nextStorage
				? nextStorage.allocate({ [mg.goodType]: 1 }, { type: 'convey.hop', movement: mg })
				: undefined
		const moving = character.game.hex.freeGoods.add(alveolus.tile, mg.goodType, mg.from)
		const time = character.vehicle.transferTime * axial.distance(mg.from, hop)
		const timeout = setTimeout(() => {
			debugger
		}, 2000)
		return new MoveToStep(time, moving, hop, 'work', `convey.${mg.goodType}`)
			.canceled(() => {
				hopAlloc?.cancel()
				mg.allocations.target.cancel()
				mg.demander.advertise()
				mg.finish()
			})
			.finished(() => {
				clearTimeout(timeout)
				moving.remove()
				if (!mg.path.length) {
					mg.allocations.target.fulfill()
				} else {
					hopAlloc!.fulfill()
					mg.allocations.source = nextStorage!.reserve(
						{ [mg.goodType]: 1 },
						{
							type: 'convey.path',
							movement: mg,
						},
					)
				}
			})
			.final(() => {
				if (!moving.isRemoved) debugger
			})
	}
	@contract()
	harvestStep() {
		const unbuiltLand = this[subject].tile.content as UnBuiltLand
		assert(unbuiltLand instanceof UnBuiltLand, 'tile.content must be an UnBuiltLand')
		const alveolus = this[subject].assignedAlveolus as Ssh.AlveolusDefinition<Ssh.HarvestingAction>
		assert(alveolus, 'assignedAlveolus must be set')
		assert(alveolus.action.type === 'harvest', 'assignedAlveolus.action must be a harvest')
		const action = alveolus.action as Ssh.HarvestingAction
		assert(
			action.deposit === unbuiltLand.deposit?.name,
			'assignedAlveolus.action.deposit must be the same as tile.content.deposit.name',
		)
		const deposit = unbuiltLand.deposit!
		// Check if character can store any of the output goods
		const outputGoods = alveolus.action.output
		const canStoreAny = Object.keys(outputGoods).some(
			(goodType) => this[subject].vehicle.hasRoom(goodType as GoodType) > 0,
		)
		if (!canStoreAny) return
		deposit.amount -= 1
		if (deposit.amount <= 0) {
			unbuiltLand.deposit = undefined
		}
		return new DurationStep(
			this[subject].assignedAlveolus!.workTime,
			'work',
			`harvest.${this[subject].assignedAlveolus!.name}`,
		).finished(() => {
			// Add all output goods to character inventory
			Object.entries(alveolus.action.output).forEach(([goodType, qty]) => {
				this[subject].vehicle.addGood(goodType as GoodType, qty)
			})
		})
	}
	@contract(AlveolusArkType.optional())
	transformStep() {
		const alveolus = this[subject].assignedAlveolus as TransformAlveolus
		assert(alveolus, 'assignedAlveolus must be set')
		assert(alveolus.action.type === 'transform', 'assignedAlveolus.action must be a transform')
		const action = alveolus.action
		const allocations: AllocationBase[] = []
		const inputAllocation = alveolus.storage.reserve(action.inputs as Goods, {
			type: 'transform.input',
			alveolus,
			inputs: action.inputs,
		})
		allocations.push(inputAllocation)

		const outputAllocation = alveolus.storage.allocate(action.output as Goods, {
			type: 'transform.output',
			alveolus,
			output: action.output,
		})
		allocations.push(outputAllocation)
		return new DurationStep(alveolus.workTime, 'work', `transform.${alveolus.name}`)
			.finished(() => {
				for (const allocation of allocations) allocation.fulfill()
				alveolus.advertise()
			})
			.canceled(() => {
				for (const allocation of allocations) allocation.cancel()
			})
	}
}

export { WorkFunctions }
