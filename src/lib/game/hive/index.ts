import { alveoli } from '$assets/game-content'
import type { AlveolusType } from '$lib/arktype'
import type { Alveolus } from '../board/content/alveolus'
import { GcClasses } from '../board/content/utils'
import type { Tile } from '../board/tile'
import { BuildAlveolus } from './build'
import { EngineerAlveolus } from './engineer'
import { GatherAlveolus } from './gather'
import { HarvestAlveolus } from './harvest'
import { StorageAlveolus } from './storage'
import { TransformAlveolus } from './transform'

export const alveolusClass = GcClasses(
	(def: Ssh.AlveolusDefinition) =>
		({
			harvest: HarvestAlveolus,
			transform: TransformAlveolus,
			gather: GatherAlveolus,
			build: BuildAlveolus,
			engineer: EngineerAlveolus,
			storage: StorageAlveolus,
		})[def.action.type],
	alveoli,
) as Record<AlveolusType, new (tile: Tile) => Alveolus>

export * from './hive'
