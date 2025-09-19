import type { GoodType } from '$lib/arktype'
import type { Storage } from '../../storage'
import type { Tile } from '../tile'

export interface TileContent extends Storage {
	readonly tile: Tile
	// TODO: translate-> name = translation set on load
	readonly name?: string
	destroy?(): void
	readonly debugInfo: Record<string, any>
	readonly walkTime: number
	readonly background: string
	/**
	 * List the goods on the tile
	 * @returns A record of goods and their quantities
	 */
	get goods(): { [k in GoodType]?: number }
	/**
	 * Render the tile
	 * @param tile - The tile to render
	 * @returns The container child to render
	 */
	render(tile: Tile): any
	/**
	 * Check if this tile content can perform the given action
	 * @param action - The action to check
	 * @returns true if the action can be performed
	 */
	canInteract?(action: string): boolean
}

// Re-export content classes
export * from './module'
export * from './unbuilt-land'
