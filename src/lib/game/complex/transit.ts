import { noStorage } from '$lib/game/storage'
import { Module } from '../board/content/module'
import type { Tile } from '../board/tile'

export class TransitModule extends Module {
	declare action: Ssh.TransitAction
	constructor(tile: Tile) {
		const def: Ssh.ModuleDefinition = new.target.prototype
		if (def.action.type !== 'transit') {
			throw new Error('TransitModule can only be created from a transit action')
		}
		super(tile, noStorage)
	}
}
