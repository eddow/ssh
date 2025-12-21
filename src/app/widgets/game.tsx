import { effect } from 'mutts/src'

import type { InteractiveGameObject } from '$lib/game'
import { css } from '$lib/css'
import { GameView } from '$lib/game/game'
import { Tile } from '$lib/game/board/tile'
import {
	games,
	interactionMode,
	selectionState,
	validateStoredSelectionState,
} from '$lib/globals'
import type { AlveolusType } from '$lib/types/base'

css`
.dockview-widget--game {
	width: 100%;
	height: 100%;
}
`

const GameWidget = (
	props: {
		params?: { game?: string }
		api: any
		title: string
		size: { width: number; height: number }
	},
	scope: { api: any },
) => {
	const gameName = props.params?.game ?? 'GameX'
	const game = games.game(gameName)
	let container: HTMLElement | undefined
	let gameView: GameView | undefined
	const containerId = `game-container-${props.api?.id ?? Math.random().toString(36).substr(2, 9)}`

	const handleProjectSelection = (object: InteractiveGameObject) => {
		selectionState.selectedUid = object.uid
		const panelId = selectionState.panelId ?? 'selection-info'
		const dock = scope.api
		if (!dock) return
		const existing = dock.getPanel?.(panelId)
		if (existing) {
			existing.api?.updateParameters?.({ uid: object.uid })
			existing.focus?.()
			selectionState.panelId = existing.id
			return
		}
		const panel = dock.addPanel?.({
			id: panelId,
			component: 'selection-info',
			params: { uid: object.uid },
		})
		if (panel) {
			selectionState.panelId = panel.id
			panel.focus?.()
		}
	}

	const handleBuildingAction = (_event: MouseEvent, object: InteractiveGameObject) => {
		if (!(object instanceof Tile)) return false

		const tile = object
		const action = interactionMode.selectedAction
		const alveolusType = action.replace('build:', '') as AlveolusType
		const success = tile.build(alveolusType)
		return Boolean(success)
	}

	const handleZoningAction = (_event: MouseEvent, object: InteractiveGameObject) => {
		if (!(object instanceof Tile)) return false
		const tile = object
		const action = interactionMode.selectedAction
		const zoneType = action.replace('zone:', '')
		if (zoneType === 'none') tile.zone = undefined
		else tile.zone = zoneType as any
		return true
	}

	const handleZoningDrag = (tiles: Tile[]) => {
		const action = interactionMode.selectedAction
		const zoneType = action.replace('zone:', '')
		for (const tile of tiles) {
			if (tile.content?.canInteract?.(action)) {
				if (zoneType === 'none') tile.zone = undefined
				else tile.zone = zoneType as any
			}
		}
	}

	const gameEvents = {
		objectClick(event: MouseEvent, object: InteractiveGameObject) {
			if (event.button !== 0) return
			const action = interactionMode.selectedAction
			if (action.startsWith('build:')) {
				const applied = handleBuildingAction(event, object)
				if (applied && !event.shiftKey) interactionMode.selectedAction = ''
				return
			}
			if (action.startsWith('zone:')) {
				const applied = handleZoningAction(event, object)
				if (applied && !event.shiftKey) interactionMode.selectedAction = ''
				return
			}
			handleProjectSelection(object)
		},
		objectDrag(tiles: Tile[], event: MouseEvent) {
			if (!interactionMode.selectedAction.startsWith('zone:')) return
			handleZoningDrag(tiles)
			if (!event.shiftKey) interactionMode.selectedAction = ''
		},
	}

	props.title = 'Game'

	effect(() => {
		const { width, height } = props.size ?? { width: 0, height: 0 }
		if (!gameView?.pixi?.renderer) return
		gameView.pixi.renderer.resize(Math.max(width, 1), Math.max(height, 1))
	})

	effect(() => {
		game.on(gameEvents)
		return () => game.off(gameEvents)
	})

	// Initialize container when element is available
	effect(() => {
		// Check immediately, then with a small delay if needed
		const checkElement = () => {
			const element = document.getElementById(containerId) as HTMLElement
			if (element && !container && !gameView) {
				container = element
				// Wait for game to load before creating view to ensure content is ready
				game.loaded.then(() => {
					if (container && !gameView) {
						gameView = new GameView(game, container)
						if (scope.api) validateStoredSelectionState(scope.api)
					}
				})
				return true
			}
			return false
		}

		// Try immediately
		if (!checkElement()) {
			// If not found, try after a short delay
			const timeoutId = setTimeout(() => {
				checkElement()
			}, 10)

			return () => {
				clearTimeout(timeoutId)
				gameView?.destroy()
				gameView = undefined
				container = undefined
			}
		}

		return () => {
			gameView?.destroy()
			gameView = undefined
			container = undefined
		}
	})

	if (import.meta.hot) {
		import.meta.hot.accept(() => {
			if (gameView) {
				void gameView.reload()
			}
		})
	}

	return <div id={containerId} class="dockview-widget dockview-widget--game" />
}

export default GameWidget
