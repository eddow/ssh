import '../app.css'
import { effect, reactive, trackEffect, untracked } from 'mutts/src'
import { Button, ButtonGroup, Dockview, RadioButton, Toolbar } from 'pounce-ui/src'

import * as gameContent from '$assets/game-content'
import { configuration, games, interactionMode, getDockviewLayout } from '$lib/globals'
import ResourceImage from './components/ResourceImage'
import widgetsImport from './widgets'

// Create local copy to avoid import reassignment issues
const widgets = { ...widgetsImport }

const timeControls = [
	{ value: 'pause', label: 'Pause', icon: 'mdi:pause' },
	{ value: 'play', label: 'Play', icon: 'mdi:play' },
	{ value: 'fast-forward', label: 'Fast Forward', icon: 'mdi:fast-forward' },
	{ value: 'gonzales', label: 'Gonzales', icon: 'mdi:fast-forward-outline' },
] as const

const zoneActions = [
	{ value: 'zone:residential', label: 'Residential', icon: 'mdi:home-group' },
	{ value: 'zone:harvest', label: 'Harvest', icon: 'mdi:tree' },
	{ value: 'zone:none', label: 'Unzone', icon: 'mdi:eraser' },
] as const

const App = (_props: {}, scope: Record<string, any>) => {
	trackEffect((obj, evolution, prop) => {
		console.log('App-redo', obj, evolution, prop);
	});
	const state = reactive({ 
		api: undefined as any,
	})

	// Create app scope with reactive theme management
	const appScope = reactive({
		theme: configuration.darkMode ? 'dark' : 'light' as 'light' | 'dark',
		toggleTheme: () => {
			appScope.theme = appScope.theme === 'light' ? 'dark' : 'light'
			configuration.darkMode = appScope.theme === 'dark'
		}
	})

	// Sync theme with configuration changes
	effect(() => {
		appScope.theme = configuration.darkMode ? 'dark' : 'light'
	})

	// Sync theme with document element
	effect(() => {
		const theme = appScope.theme
		document.documentElement.dataset.theme = theme
		document.documentElement.classList.toggle('dark', theme === 'dark')
	})

	// Update scope with theme changes
	effect(() => {
		scope.theme = appScope.theme
		scope.toggleTheme = appScope.toggleTheme
	})

	const game = games.game('GameX')
	const buildableAlveoli = Object.entries(gameContent.alveoli).filter(
		([, alveolus]) => 'construction' in alveolus,
	)

	effect(() => {
		if (typeof window === 'undefined') return
		const preventBackNavigation = (event: MouseEvent) => {
			if (event.button === 3 || event.button === 4) {
				event.preventDefault()
			}
		}
		window.addEventListener('mouseup', preventBackNavigation)
		window.addEventListener('mousedown', preventBackNavigation)
		return () => {
			window.removeEventListener('mouseup', preventBackNavigation)
			window.removeEventListener('mousedown', preventBackNavigation)
		}
	})

	const ensurePanel = (component: keyof typeof widgets, id: string, params?: Record<string, any>) => {
		if (!state.api) return
		const existing = state.api.getPanel?.(id)
		if (existing) {
			if (params) existing.api?.updateParameters?.(params)
			existing.focus?.()
			return existing
		}
		return state.api.addPanel?.({
			id,
			component,
			params,
		})
	}

	const openGamePanel = () =>
		ensurePanel('game', 'game-view', {
			game: 'GameX',
		})

	const openConfigurationPanel = () => ensurePanel('configuration', 'system.configuration')

	const openSelectionPanel = () => ensurePanel('selection-info', 'selection-info')

	effect(() => {
		const shouldOpen = interactionMode.selectedAction === ''
		if (shouldOpen) {
			untracked(openSelectionPanel)
		}
	})

	return (
		<div class="app-shell">
			<Toolbar>
				<ButtonGroup>
					<Button icon="mdi:settings" aria-label="Open configuration" onClick={openConfigurationPanel} />
					<Button icon="mdi:plus" aria-label="Open game view" onClick={openGamePanel} />
					<Button icon="mdi:information-outline" aria-label="Focus selection info" onClick={openSelectionPanel} />
				</ButtonGroup>
				<Toolbar.Spacer visible />
				<ButtonGroup>
					{timeControls.map((option) => (
						<RadioButton
							icon={option.icon}
							value={option.value}
							group={configuration.timeControl}
							aria-label={option.label}
						/>
					))}
				</ButtonGroup>
				<Toolbar.Spacer visible />
				<ButtonGroup>
					<RadioButton
						icon="mdi:cursor-default-outline"
						value=""
						group={interactionMode.selectedAction}
						aria-label="Select"
					/>
				</ButtonGroup>
				<Toolbar.Spacer visible />
				<ButtonGroup>
					{buildableAlveoli.map(([name, alveolus]) => {
						const action = `build:${name}`
						return (
							<RadioButton
								value={action}
								group={interactionMode.selectedAction}
								aria-label={`Build ${name}`}
							>
								<ResourceImage
									game={game}
									sprite={alveolus.sprites?.[0]}
									width={24}
									height={24}
									alt={name}
								/>
							</RadioButton>
						)
					})}
				</ButtonGroup>
				<Toolbar.Spacer visible />
				<ButtonGroup>
					{zoneActions.map((zone) => (
						<RadioButton
							icon={zone.icon}
							value={zone.value}
							group={interactionMode.selectedAction}
							aria-label={zone.label}
						/>
					))}
				</ButtonGroup>
				<Toolbar.Spacer />
				<Button
					icon={appScope.theme === 'dark' ? 'mdi:weather-night' : 'mdi:weather-sunny'}
					aria-label="Toggle dark mode"
					onClick={appScope.toggleTheme}
				/>
			</Toolbar>

			<main class="app-main">
				<scope theme={appScope.theme} toggleTheme={appScope.toggleTheme}>
					<Dockview 
						el:class="dockview-container" 
						api={state.api} 
						widgets={widgets}
						layout={getDockviewLayout()}
						theme={{light: 'dockview-theme-light', dark: 'dockview-theme-dracula'}}
					/>
				</scope>
			</main>
		</div>
	)
}

export default App


