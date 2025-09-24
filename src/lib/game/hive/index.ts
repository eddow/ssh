import { alveoli } from '$assets/game-content'
import type { AlveolusType } from '$lib/arktype'
import type { Alveolus } from '../board/content/alveolus'
import { GcClasses } from '../board/content/utils'
import type { Tile } from '../board/tile'
import { HarvestAlveolus } from './harvest'
import { TransformAlveolus } from './transform'
import { TransitAlveolus } from './transit'

export const alveolusClass = GcClasses(
	(def: Ssh.AlveolusDefinition) =>
		({
			harvest: HarvestAlveolus,
			transform: TransformAlveolus,
			transit: TransitAlveolus,
		})[def.action.type],
	alveoli,
) as Record<AlveolusType, new (tile: Tile) => Alveolus>

export * from './hive'
