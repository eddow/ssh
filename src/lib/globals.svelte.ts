import { Game } from "./game"

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

const uniqueGame = new Game()

export function play(game: string) {
	return uniqueGame
}
