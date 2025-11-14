import { effect, reactive, watch } from 'mutts/src'

import type { InteractiveGameObject } from '$lib/game'
import {
	games,
	registerObjectInfoPanel,
	selectionState,
	unregisterObjectInfoPanel,
} from '$lib/globals'

const SelectionInfoWidget = (
	props: {
		params?: { uid?: string }
		api: any
		title: string
		size: { width: number; height: number }
	},
) => {
	const game = games.game('GameX')
	const state = reactive({
		object: undefined as InteractiveGameObject | undefined,
		logs: [] as string[],
		isPinned: false,
	})

	let stopLogs: (() => void) | undefined

	const fallbackPanelId = props.api?.id ?? 'selection-info'

	effect(() => {
		const pinnedUid = props.params?.uid
		state.isPinned = Boolean(pinnedUid)
		if (pinnedUid) {
			registerObjectInfoPanel(pinnedUid, fallbackPanelId)
			return () => {
				unregisterObjectInfoPanel(pinnedUid)
			}
		}
		selectionState.panelId = fallbackPanelId
		return () => {
			if (selectionState.panelId === fallbackPanelId) selectionState.panelId = undefined
		}
	})

	effect(() => {
		const uid = props.params?.uid ?? selectionState.selectedUid
		if (!uid) {
			state.object = undefined
			state.logs = []
			props.title = 'Selection'
			return
		}
		const object = game.getObject(uid)
		state.object = object
		props.title = object?.title ?? 'Selection'
	})

	effect(() => {
		stopLogs?.()
		const object = state.object
		if (!object) {
			state.logs = []
			stopLogs = undefined
			return
		}
		stopLogs = watch(object.logs, (entries: string[]) => {
			state.logs = [...entries]
		})
		return () => {
			stopLogs?.()
			stopLogs = undefined
		}
	})

	return (
		<div class="selection-info-panel">
			{state.object ? (
				<>
					<div class="selection-info-panel__summary">
						<h3>{state.object.title ?? 'Object'}</h3>
						<p>ID: {state.object.uid}</p>
					</div>
					<div class="selection-info-panel__logs" role="log">
						{state.logs.length ? (
							state.logs.map((line) => (
								<div class="selection-info-panel__logs-line">{line}</div>
							))
						) : (
							<p class="selection-info-panel__empty">No activity logged yet.</p>
						)}
					</div>
				</>
			) : (
				<div class="selection-info-panel__empty">Select an object in the game view to inspect it.</div>
			)}
		</div>
	)
}

export default SelectionInfoWidget
