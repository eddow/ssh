<script lang="ts">
	import type { DockviewApi } from 'dockview-core'
	import { Toolbar, ToolbarButton, ToolbarGroup } from 'flowbite-svelte'
	import {
		AdjustmentsHorizontalOutline,
		BugOutline,
		FloppyDiskAltOutline
	} from 'flowbite-svelte-icons'
	import { onMount } from 'svelte'
	import { DockView } from '$lib/dockview'
	import createGameViewRenderer from '$lib/dockview/game-view'
	import { configuration } from '$lib/globals.svelte'
	import widgets from './widgets'

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
			const id = `system.${widget}`
			let panel = api!.getPanel(id)
			if (panel) {
				if (panel.api.isActive) panel.api.close()
				else panel.api.setActive()
			} else {
				const otherSystem = api!.panels.find((p) => p.id.startsWith('system.'))
				panel = dockview!.addWidget(
					widget,
					{},
					{
						id,
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
	}
	const layoutJson = location.host.startsWith('localhost') ? localStorage.getItem('layout') : null
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

			api!.addPanel({
				id: `game.${crypto.randomUUID()}`,
				component: 'gameView',
				title: 'Game X',
				params: {
					game: 'GameX'
				},
				position: {
					direction: 'right'
				}
			})
		}
	})
	function preventDefault(event: MouseEvent) {
		if (event.button === 4 || event.button === 3) {
			event.preventDefault()
		}
	}
	function addGame() {
		dockview!.addWidget('game', {
			game: 'GameX'
		})
	}
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
		renderers={{ gameView: createGameViewRenderer }}
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
