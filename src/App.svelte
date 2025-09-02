<script lang="ts">
	import type { DockviewApi } from 'dockview-core'
	import { Toolbar, ToolbarButton, ToolbarGroup } from 'flowbite-svelte'
	import {
		AdjustmentsHorizontalOutline,
		BugOutline,
		FloppyDiskAltOutline
	} from 'flowbite-svelte-icons'
	import { onMount } from 'svelte'
	import { DockView } from './components/dockview'
	import { configuration } from '$lib/globals.svelte'
	import widgets from './widgets'
	import type { InteractiveGameObject } from './lib/game/object'

	$effect(() => {
		if (configuration.darkMode) document.documentElement.classList.add('dark')
		else document.documentElement.classList.remove('dark')
	})
	$effect(() => {
		const disposable = api!.onDidLayoutChange(() => {
			const layout = api!.toJSON()
			localStorage.setItem('layout', JSON.stringify(layout))
		})
		return () => {
			disposable.dispose()
		}
	})

	function showSystem(widget: 'configuration' | 'games' | 'debug') {
		return () => {
			const otherSystem = api!.panels.find((p) => p.id.startsWith('system.'))
			dockview!.toggleUniqueDock(
				widget,
				{},
				{
					id: `system.${widget}`,
					...(otherSystem
						? {
								position: {
									direction: 'within',
									referencePanel: otherSystem
								}
							}
						: { floating: true })
				}
			)
		}
	}
	function showProperties(object: InteractiveGameObject) {
		dockview!.addDock(
			'selection-info',
			{ uid: object.uid },
			{
				position: {
					direction: 'right'
				}
			}
		)
	}
	const layoutJson = null // location.host.startsWith('localhost') ? localStorage.getItem('layout') : null
	let dockview = $state<DockView | undefined>(undefined)
	let api = $state<DockviewApi | undefined>(undefined)
	onMount(() => {
		if (layoutJson)
			try {
				api!.fromJSON(JSON.parse(layoutJson))
				return
			} catch {
				localStorage.removeItem('layout')
			}
		else {
			showSystem('configuration')()
			addGame()
		}
	})
	function preventDefault(event: MouseEvent) {
		if (event.button === 4 || event.button === 3) {
			event.preventDefault()
		}
	}
	function addGame() {
		dockview!.showUniqueDock(
			'game',
			{ game: 'GameX' },
			{
				id: 'game-view',
				position: {
					direction: 'within'
				}
			}
		)
	}
	// todo: dockview template #toolbar -> injected API
</script>

<!-- Prevent default navigation behaviors associated to buttons 3 & 4 -->
<svelte:body onmouseup={preventDefault} onmousedown={preventDefault} />
<div class="screen bg-white dark:bg-gray-900">
	<Toolbar>
		<ToolbarGroup>
			<ToolbarButton onclick={showSystem('configuration')} title="Configuration">
				<AdjustmentsHorizontalOutline class="w-6 h-6" />
			</ToolbarButton>
			<ToolbarButton onclick={addGame} title="Games">
				<FloppyDiskAltOutline class="w-6 h-6" />
			</ToolbarButton>
			<ToolbarButton onclick={showSystem('debug')} title="Debug">
				<BugOutline class="w-6 h-6" />
			</ToolbarButton>
		</ToolbarGroup>
	</Toolbar>
	<DockView
		class="content"
		theme={configuration.darkMode ? 'dracula' : 'light'}
		bind:api
		bind:this={dockview}
		{widgets}
	/>
</div>

<style>
	.screen {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
	}

	:global(.content) {
		flex: 1;
	}
</style>
