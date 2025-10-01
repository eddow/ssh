import { noStorage } from '$lib/game/storage'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'

export class GatherAlveolus extends Alveolus {
	declare action: Ssh.GatherAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'gather') {
			throw new Error('GatherAlveolus can only be created from a gather action')
		}
		super(tile, noStorage)
	}
}
