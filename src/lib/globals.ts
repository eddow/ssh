import type { DockviewApi } from 'dockview-core'
import { Eventful, reactive } from 'mutts/src'
import { stored } from 'pounce-ui/src'
import { Game, type GameEvents, type InteractiveGameObject } from './game'
import { chopSaw as patches } from './game/exampleGames'

export interface Configuration {
	darkMode: boolean
	timeControl: 'pause' | 'play' | 'fast-forward' | 'gonzales'
}

function getDefaultConfiguration(): Configuration {
	if (typeof window === 'undefined') {
		return { darkMode: false, timeControl: 'play' }
	}

	const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
	return {
		darkMode: prefersDark,
		timeControl: 'play',
	}
}

export const configuration = stored<Configuration>(getDefaultConfiguration())
export const debugInfo = reactive<Record<string, unknown>>({})

export const dockviewLayout = stored<{ layout: any }>({ layout: undefined })

// Validate and fix dockview layout data
function validateDockviewLayout(layout: any): any {
	if (!layout || typeof layout !== 'object') {
		return undefined
	}

	// Helper to recursively fix data structs
	const fixData = (node: any) => {
		if (!node || typeof node !== 'object') return

		// Fix data: {} -> data: []
		if (node.data && typeof node.data === 'object' && !Array.isArray(node.data) && Object.keys(node.data).length === 0) {
			node.data = []
		}

		// Recurse into children/data
		if (Array.isArray(node.children)) {
			node.children.forEach(fixData)
		}
		if (Array.isArray(node.data)) {
			node.data.forEach(fixData)
		}
		// Also check grid root
		if (node.root) {
			fixData(node.root)
		}
	}

	try {
		// Deep clone to avoid mutating the input if it's immutable/stored state
		const cleanLayout = JSON.parse(JSON.stringify(layout))
		
		// Check basic structure
		if (!cleanLayout.grid || !cleanLayout.grid.root) {
			console.warn('Dockview layout missing grid/root, clearing.')
			dockviewLayout.layout = undefined
			return undefined
		}

		fixData(cleanLayout.grid)
		
		return cleanLayout
	} catch (e) {
		console.warn('Error validating dockview layout:', e)
		dockviewLayout.layout = undefined
		return undefined
	}
}

// Safe getter for dockview layout with validation
export function getDockviewLayout(): any {
	const layout = dockviewLayout.layout
	return validateDockviewLayout(layout)
}

type GamedEvents = {
	[key in keyof GameEvents]: (game: Game, ...args: Parameters<GameEvents[key]>) => void
}

class Games extends Eventful<GamedEvents> {
	private games = new Map<string, Game>()

	game(name: string) {
		const existing = this.games.get(name)
		if (existing) return existing

		const instance = new Game(
			{
				boardSize: 12,
				terrainSeed: 23,
				characterCount: 3,
				characterRadius: 5,
			},
			patches,
		)
		this.games.set(name, instance)
		return instance
	}
}

export const games = new Games()

export const mrg = reactive({
	hoveredObject: undefined as InteractiveGameObject | undefined,
})

export const interactionMode = reactive({
	selectedAction: '' as string,
})

interface SelectionState {
	panelId?: string
	selectedUid?: string
}

function loadSelectionState(): SelectionState {
	if (typeof window === 'undefined') return {}

	const stored = localStorage.getItem('selectionState')
	if (!stored) return {}

	try {
		return JSON.parse(stored) as SelectionState
	} catch {
		return {}
	}
}

const selectionStateInternal = reactive<SelectionState>(loadSelectionState())

function persistSelectionState() {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem('selectionState', JSON.stringify(selectionStateInternal))
	} catch {
		// Ignore persistence failures (e.g. quota issues)
	}
}

export const selectionState = {
	get panelId() {
		return selectionStateInternal.panelId
	},
	set panelId(value: string | undefined) {
		selectionStateInternal.panelId = value
		persistSelectionState()
	},
	get selectedUid() {
		return selectionStateInternal.selectedUid
	},
	set selectedUid(value: string | undefined) {
		selectionStateInternal.selectedUid = value
		persistSelectionState()
	},
}

const objectInfoPanels = new Map<string, string>()

export function registerObjectInfoPanel(uid: string, panelId: string) {
	objectInfoPanels.set(uid, panelId)
}

export function unregisterObjectInfoPanel(uid: string) {
	objectInfoPanels.delete(uid)
}

export function getObjectInfoPanelId(uid: string): string | undefined {
	return objectInfoPanels.get(uid)
}

export function validateStoredSelectionState(api?: DockviewApi) {
	if (!selectionState.panelId || !api) return
	const panel = api.getPanel(selectionState.panelId)
	if (!panel) {
		selectionState.panelId = undefined
	}
}
