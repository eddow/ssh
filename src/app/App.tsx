import '../app.css'
import { effect } from 'mutts/src'
import { Button, ButtonGroup, Dockview, Icon, RadioButton, Toolbar } from 'pounce-ui/src'

import * as gameContent from '$assets/game-content'
import { configuration, games, interactionMode } from '$lib/globals'
import ResourceImage from './components/ResourceImage'
import widgets from './widgets'

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

const App = () => {
	let api: any

	const game = games.game('GameX')
	const buildableAlveoli = Object.entries(gameContent.alveoli).filter(
		([, alveolus]) => 'construction' in alveolus,
	)

	const shouldPersistLayout =
		typeof location !== 'undefined' && location.host.startsWith('localhost')

	effect(() => {
		const theme = configuration.darkMode ? 'dark' : 'light'
		document.documentElement.dataset.theme = theme
		document.documentElement.classList.toggle('dark', configuration.darkMode)
		if (api?.setTheme) {
			api.setTheme(configuration.darkMode ? 'dracula' : 'light')
		}
	})

	effect(() => {
		if (typeof localStorage === 'undefined') return
		localStorage.setItem('configuration', JSON.stringify(configuration))
	})

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

	let layoutInitialized = false
	const restoreOrBootstrapLayout = () => {
		if (!api || layoutInitialized) return
		layoutInitialized = true
		if (shouldPersistLayout && typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('layout')
			if (saved) {
				try {
					api.fromJSON(JSON.parse(saved))
					return
				} catch (error) {
					console.warn('Unable to restore dockview layout:', error)
					localStorage.removeItem('layout')
				}
			}
		}
		openConfigurationPanel()
		openGamePanel()
	}

	const persistLayout = () => {
		if (!api || !shouldPersistLayout || typeof localStorage === 'undefined') return
		const layout = api.toJSON()
		localStorage.setItem('layout', JSON.stringify(layout))
	}

	effect(() => {
		if (!api) return
		restoreOrBootstrapLayout()
		const disposable = api.onDidLayoutChange?.(() => {
			persistLayout()
		})
		return () => disposable?.dispose?.()
	})

	const ensurePanel = (component: keyof typeof widgets, id: string, params?: Record<string, any>) => {
		if (!api) return
		const existing = api.getPanel?.(id)
		if (existing) {
			if (params) existing.api?.updateParameters?.(params)
			existing.focus?.()
			return existing
		}
		return api.addPanel?.({
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
		if (interactionMode.selectedAction === '') {
			openSelectionPanel()
		}
	})

	const toggleDarkMode = () => {
		configuration.darkMode = !configuration.darkMode
	}

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
					icon={configuration.darkMode ? 'mdi:weather-night' : 'mdi:weather-sunny'}
					aria-label="Toggle dark mode"
					onClick={toggleDarkMode}
				/>
			</Toolbar>

			<main class="app-main">
				<Dockview el:class="dockview-container" api={api} widgets={widgets} />
			</main>
		</div>
	)
}

export default App


