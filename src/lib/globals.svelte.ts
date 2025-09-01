//import { createGame } from '$lib/hexClash/game'
import type { DockviewApi } from "dockview-core"

export interface IConfiguration {
	darkMode?: boolean
}

const storedConfig = localStorage.getItem("configuration")
export const configuration = $state(
	storedConfig
		? JSON.parse(storedConfig)
		: {
				darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
			},
)
export const debugInfo = $state({} as Record<string, any>)
