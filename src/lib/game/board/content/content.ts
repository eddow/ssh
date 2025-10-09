import { type } from 'arktype'
import type { ScopedCallback } from 'mutts/src'
import { type Game, GameObject } from '$lib/game'
import type { Storage } from '../../storage'
import type { Tile } from '../tile'

export abstract class TileContent extends GameObject {
	abstract readonly tile: Tile
	// TODO: translate-> name = translation set on load
	abstract readonly name?: string
	abstract readonly debugInfo: Record<string, any>
	abstract readonly walkTime: number
	abstract readonly background: string
	// Optional storage - undefined for tiles that don't store goods
	abstract storage?: Storage<any>
	/**
	 * Render the tile content
	 * @param game - The game instance
	 * @returns A cleanup function to be called when the content is removed
	 */
	abstract render(game: Game): ScopedCallback | undefined
	/**
	 * Check if this tile content can perform the given action
	 * @param action - The action to check
	 * @returns true if the action can be performed
	 */
	abstract canInteract?(action: string): boolean
}

export const TileContentArkType = type.instanceOf(TileContent)
