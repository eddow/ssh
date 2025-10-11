import { alveoli } from '$assets/game-content'
import { assert } from '$lib/debug'
import { UnBuiltLand } from '$lib/game/board/content/unbuilt-land'
import { alveolusClass } from '$lib/game/hive'
import { BuildAlveolus } from '$lib/game/hive/build'
import type { TransformAlveolus } from '$lib/game/hive/transform'
import type { Character } from '$lib/game/population/character'
import type { AllocationBase } from '$lib/game/storage'
import { contract, type Goods, type GoodType } from '$lib/types'
import { axial } from '$lib/utils'
import { subject } from '../scripts'
import { DurationStep, MoveToStep, WaitForPredicateStep } from '../steps'
import type { WorkPlan } from '.'

class WorkFunctions {
	declare [subject]: Character
	@contract('WorkPlan')
	// TODO: specific cases for `convey`: preparationTime, assignedConveyor, ... ?
	prepare(workPlan: WorkPlan) {
		if (['convey', 'offload'].includes(workPlan.jobType)) return
		assert(
			this[subject].assignedAlveolus?.preparationTime,
			'assignedAlveolus must be set and have a preparationTime',
		)
		return workPlan.jobType !== 'convey'
			? new DurationStep(
					this[subject].assignedAlveolus!.preparationTime,
					'work',
					`prepare.${workPlan.jobType}`,
				)
			: undefined
	}
	@contract()
	waitForIncomingGoods() {
		return new WaitForPredicateStep(
			'waitIncomingGoods',
			() => this[subject].assignedAlveolus!.goodMovements.length > 0,
		)
	}
	@contract('object?')
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
		assert(nextStorage, 'nextStorage must be defined')
		const hopAlloc = mg.path.length
			? nextStorage.allocate({ [mg.goodType]: 1 }, { type: 'convey.hop', movement: mg })
			: undefined
		const moving = character.game.hex.freeGoods.add(alveolus.tile, mg.goodType, mg.from)
		const time = character.vehicle.transferTime * axial.distance(mg.from, hop)
		return new MoveToStep(time, moving, hop, 'work', `convey.${mg.goodType}`)
			.canceled(() => {
				hopAlloc?.cancel()
				mg.allocations.target.cancel()
				mg.finish()
			})
			.finished(() => {
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
	@contract('object?') // TODO: object??
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
			})
			.canceled(() => {
				for (const allocation of allocations) allocation.cancel()
			})
	}
	@contract()
	constructionStep() {
		// Character must already be on the construction site tile
		const content = this[subject].tile.content
		assert(content instanceof BuildAlveolus, 'Tile must be a BuildAlveolus')
		const site = content as BuildAlveolus
		assert(site.isReady, 'Construction site must be ready')
		const targetType = site.target as keyof typeof alveolusClass
		const TargetClass = alveolusClass[targetType]
		assert(TargetClass, 'Target alveolus class must exist')
		return new DurationStep(
			alveoli[targetType].construction.time,
			'work',
			`construct.${targetType}`,
		).finished(() => {
			// Replace the tile content with the target alveolus
			site.tile.content = new TargetClass(site.tile)
		})
	}
}

export { WorkFunctions }
