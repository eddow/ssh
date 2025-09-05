<script lang="ts">
	import { unwrap } from 'mutts'
	import type { HexTile } from '$lib/game'
	import { Badge, Range, Button } from 'flowbite-svelte'
	import { games, muttsArray } from '$lib/globals.svelte'

	let { tile }: { tile: HexTile } = $props()
	const game = games.game('GameX')
	let building = $derived(tile.building) //mutts2svelte(tile, 'building')
	//let assignedWorkers = $derived(tile.building?.assignedWorkers ?? [])
	let assignedWorkers = $derived(muttsArray(tile.building?.assignedWorkers ?? []))
	let weights = $derived(muttsArray(tile.building?.activityWeights ?? []))
	//let weights = $state<number[]>([])
	// TODO: mutts array reactivity interacts badly with svelte
	//weights = (() => unwrap(building?.activityWeights ?? []))()
	function updateActivityWeight(actionIndex: number, value: number) {
		if (building && building.activityWeights) {
			building.activityWeights[actionIndex] = value
			//weights[actionIndex] = value
		}
	}

	function assignWorker() {
		if (!building || !building.assignedWorkers) return

		// Check if building has capacity for more workers
		if (building.assignedWorkers.length >= building.maxWorkers) {
			alert(`Building is at maximum capacity (${building.maxWorkers} workers)`)
			return
		}

		// Find nearest unemployed character
		const nearestCharacter = game.population.findNearestUnemployed(tile.coord)
		if (!nearestCharacter) {
			alert('No unemployed characters available')
			return
		}

		// Assign character to building
		nearestCharacter.assignedBuilding = building
		building.assignedWorkers.push(nearestCharacter)
		assignedWorkers = assignedWorkers
	}

	function freeWorker() {
		if (!building || building.assignedWorkers.length === 0) return

		// Get the first assigned character
		const assignedCharacter = building.assignedWorkers[0]

		if (assignedCharacter) {
			// Free the character
			assignedCharacter.assignedBuilding = undefined
			// Remove from array
			const index = building.assignedWorkers.indexOf(assignedCharacter)
			if (index > -1) {
				building.assignedWorkers.splice(index, 1)
			}
			assignedWorkers = assignedWorkers
		}
	}
</script>

<div class="building-properties">
	<h2 class="text-lg font-semibold mb-2">Building Properties</h2>
	{#if building}
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="font-medium">Name:</span>
				<Badge color="indigo">{building.name}</Badge>
			</div>

			<div class="flex items-center gap-2">
				<span class="font-medium">Max Workers:</span>
				<Badge color="blue">{building.maxWorkers}</Badge>
			</div>

			<div class="flex items-center gap-2">
				<span class="font-medium">Carrying Capacity:</span>
				<Badge color="green">{building.carryingCapacity}</Badge>
			</div>

			<div class="flex items-center gap-2">
				<span class="font-medium">Rest Ease:</span>
				<Badge color="yellow">{building.restEase}</Badge>
			</div>

			<div class="flex items-center gap-2">
				<span class="font-medium">Assigned Workers:</span>
				<Badge color="purple">{assignedWorkers?.length ?? 0} / {building.maxWorkers}</Badge>
			</div>

			<div class="flex items-center gap-2 mt-3">
				<Button
					size="sm"
					onclick={assignWorker}
					disabled={(assignedWorkers?.length ?? 0) >= building.maxWorkers}
				>
					Assign Worker
				</Button>
				<Button
					size="sm"
					color="red"
					onclick={freeWorker}
					disabled={(assignedWorkers?.length ?? 0) === 0}
				>
					Free Worker
				</Button>
			</div>

			{#if Object.keys(building.goodsCapacity).length > 0}
				<div class="mt-3">
					<span class="font-medium">Goods Capacity:</span>
					<div class="flex flex-wrap gap-1 mt-1">
						{#each Object.entries(building.goodsCapacity) as [good, capacity]}
							<Badge color="purple">{good}: {capacity}</Badge>
						{/each}
					</div>
				</div>
			{/if}

			{#if building.actions && building.actions.length > 0}
				<div class="mt-3">
					<span class="font-medium">Actions:</span>
					<div class="space-y-2 mt-1">
						{#each building.actions as action, index}
							<div class="text-sm p-3 bg-gray-100 rounded">
								<div class="flex items-center gap-2 mb-2">
									<Badge color="blue">{action.type}</Badge>
									{#if action.type === 'harvesting'}
										<span>Harvest {action.deposit} → {Object.keys(action.output)[0]}</span>
									{:else if action.type === 'transformation'}
										<span>
											{Object.entries(action.inputs)
												.map(([input, amount]) => `${amount} ${input}`)
												.join(' + ')}
											→ {Object.entries(action.outputs)
												.map(([output, amount]) => `${amount} ${output}`)
												.join(' + ')}
										</span>
									{/if}
									<Badge color="red">{action.time}s</Badge>
								</div>

								<div class="flex items-center gap-2">
									<span class="text-xs text-gray-600">Activity Weight:</span>
									<Range
										min="0"
										max="1"
										step="0.01"
										value={building.activityWeights?.[index] ?? 0.5}
										oninput={(e) => {
											const target = e.target as HTMLInputElement
											updateActivityWeight(index, parseFloat(target.value))
										}}
										class="flex-1"
									/>
									<span class="text-xs font-mono w-8 text-right">
										{Math.round((weights[index] ?? 0.5) * 100)}%
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-gray-500">No building data available</p>
	{/if}
</div>

<style>
	.building-properties {
		padding: 1rem;
	}
</style>
