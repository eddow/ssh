import type { ContainerChild } from 'pixi.js'
import type { Game } from '$lib/game'
import type { Storage } from '../../storage'
import type { Tile } from '../tile'

export interface TileContent extends Storage<any> {
	readonly tile: Tile
	// TODO: translate-> name = translation set on load
	readonly name?: string
	destroy?(): void
	readonly debugInfo: Record<string, any>
	readonly walkTime: number
	readonly background: string
	/**
	 * Render the tile content
	 * @param game - The game instance
	 * @returns The container child to render
	 */
	render(game: Game): ContainerChild
	/**
	 * Check if this tile content can perform the given action
	 * @param action - The action to check
	 * @returns true if the action can be performed
	 */
	canInteract?(action: string): boolean
}
