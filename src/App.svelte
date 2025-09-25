<script lang="ts">
import Icon from '@iconify/svelte'
import type { DockviewApi } from 'dockview-core'
import { DockView } from 'dockview-svelte/src'
import { ButtonGroup, RadioButton, Toolbar, ToolbarButton, ToolbarGroup } from 'flowbite-svelte'
// Icons now handled by IconifyIcon component
import { onMount } from 'svelte'
import * as gameContent from '$assets/game-content'
import ResourceImage from '$components/parts/resourceImage.svelte'
import DarkMode from '$components/parts/system/dark-mode.svelte'
import FlagLanguageSelector from '$components/parts/system/FlagLanguageSelector.svelte'
import { configuration, games, interactionMode } from '$lib/globals.svelte'
import { T } from '$lib/i18n'
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
								referencePanel: otherSystem,
							},
						}
					: { floating: true }),
			},
		)
	}
}
const game = games.game('GameX')
const layoutJson = location.host.startsWith('localhost') ? localStorage.getItem('layout') : null
let dockview = $state<DockView | undefined>(undefined)
let api = $state<DockviewApi | undefined>(undefined)
onMount(async () => {
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
				direction: 'within',
			},
		},
	)
}
// todo: dockview template #toolbar -> injected API ?
</script>

<!-- Prevent default navigation behaviors associated to buttons 3 & 4 -->
<svelte:body onmouseup={preventDefault} onmousedown={preventDefault} />
<div class="screen bg-white dark:bg-gray-900">
	<Toolbar>
		<ToolbarGroup>
			<ToolbarButton onclick={showSystem('configuration')} title={$T.ui.configuration}>
				<Icon icon="mdi:settings" width="24" height="24" />
			</ToolbarButton>
			<ToolbarButton onclick={addGame} title={$T.ui.games}>
				<Icon icon="mdi:plus" width="24" height="24" />
			</ToolbarButton>
			<ToolbarButton onclick={showSystem('debug')} title={$T.ui.debug}>
				<Icon icon="mdi:bug" width="24" height="24" />
			</ToolbarButton>
		</ToolbarGroup>
		<ToolbarGroup>
			<ButtonGroup>
				<RadioButton
					name="action-selection"
					value=""
					bind:group={interactionMode.selectedAction}
					checkedClass="!bg-gray-200 !text-gray-900 !border-2 !border-gray-400 dark:!bg-gray-700 dark:!text-gray-100 dark:!border-gray-500"
					title={$T.ui.select}
					outline
				>
					<ResourceImage {game} sprite="select" width={24} height={24} alt={$T.ui.select} />
				</RadioButton>
			</ButtonGroup>
		</ToolbarGroup>
		<ToolbarGroup>
			<ButtonGroup>
				{#each Object.entries(gameContent.alveoli) as [name, alveolus]}
					<RadioButton
						name="action-selection"
						value={`build:${name}`}
						bind:group={interactionMode.selectedAction}
						checkedClass="!bg-gray-200 !text-gray-900 !border-2 !border-gray-400 dark:!bg-gray-700 dark:!text-gray-100 dark:!border-gray-500"
						title={$T.alveoli[name]}
						outline
					>
						<ResourceImage
							{game}
							sprite={alveolus.sprites[0]}
							width={24}
							height={24}
							alt={$T.alveoli[name]}
						/>
					</RadioButton>
				{/each}
			</ButtonGroup>
		</ToolbarGroup>

		{#snippet end()}
			<ToolbarGroup>
				<FlagLanguageSelector />
				<DarkMode bind:darkMode={configuration.darkMode} />
			</ToolbarGroup>
		{/snippet}
	</Toolbar>
	<DockView
		singleTabMode="fullwidth"
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
