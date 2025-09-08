import { Eventful, effect as mEffect, reactive } from "mutts"
import { Game, type GameEvents, type InteractiveGameObject } from "./game"

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

type GamedEvents = {
	[key in keyof GameEvents]: (game: Game, ...args: Parameters<GameEvents[key]>) => void
}

class Games extends Eventful<GamedEvents> {
	private games = new Map<string, Game>()

	game(name: string) {
		const game = this.games.get(name)
		if (!game) {
			const game = new Game()
			// Load game here
			this.games.set(name, game)
			/*game.hook(
				<Event extends keyof GameEvents>(event: Event, ...args: Parameters<GameEvents[Event]>) => {
					this.emit(event, ...([game, ...args] as Parameters<GamedEvents[Event]>))
				},
			)*/
			return game
		}
		return game
	}
}
export const games = new Games()

/**
 * Mutts Reactive Globals
 */
export const mrg = reactive({
	hoveredObject: undefined as InteractiveGameObject | undefined,
})