import { reactive } from 'mutts'
import type { InteractiveGameObject } from './game/game'

export const mrg = reactive({
	hoveredObject: undefined as InteractiveGameObject | undefined,
})

export const hoverState = reactive(new Map<InteractiveGameObject, boolean>())

export const interactionMode = reactive({
	selectedAction: '' as string,
})
