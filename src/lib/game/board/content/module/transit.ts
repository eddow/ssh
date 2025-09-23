import { noStorage } from '$lib/game/storage'
import type { Tile } from '../../tile'
import { Module } from './module'

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
