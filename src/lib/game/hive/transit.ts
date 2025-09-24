import { noStorage } from '$lib/game/storage'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'

export class TransitAlveolus extends Alveolus {
	declare action: Ssh.TransitAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'transit') {
			throw new Error('TransitAlveolus can only be created from a transit action')
		}
		super(tile, noStorage)
	}
}
