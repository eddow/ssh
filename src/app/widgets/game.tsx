import { effect } from 'mutts/src'

import type { InteractiveGameObject } from '$lib/game'
import { GameView } from '$lib/game/game'
import { Tile } from '$lib/game/board/tile'
import {
	games,
	interactionMode,
	selectionState,
	validateStoredSelectionState,
} from '$lib/globals'
import type { AlveolusType } from '$lib/types/base'

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

	const initContainer = (element: HTMLElement) => {
		container = element
		gameView = new GameView(game, container)
		if (scope.api) validateStoredSelectionState(scope.api)
		return () => {
			gameView?.destroy()
			gameView = undefined
		}
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

	if (import.meta.hot) {
		import.meta.hot.accept(() => {
			if (gameView) {
				void gameView.reload()
			}
		})
	}

	return <div class="dockview-widget dockview-widget--game" use={initContainer} />
}

export default GameWidget
