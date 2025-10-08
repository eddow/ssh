import { type } from 'arktype'
import type { ContainerChild } from 'pixi.js'
import type { Game } from '$lib/game'
import { Storage } from '../../storage'
import { type Tile, TileArkType } from '../tile'

export interface TileContent {
	readonly tile: Tile
	// TODO: translate-> name = translation set on load
	readonly name?: string
	destroy?(): void
	readonly debugInfo: Record<string, any>
	readonly walkTime: number
	readonly background: string
	// Optional storage - undefined for tiles that don't store goods
	storage?: Storage<any>
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

export const TileContent = type.object({
	tile: TileArkType,
	name: type.string.optional(),
	debugInfo: type.object({}),
	walkTime: type.number,
	background: type.string,
	storage: type.instanceOf(Storage).optional(),
})
