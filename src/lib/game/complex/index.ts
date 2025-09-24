import { modules } from '$assets/game-content'
import type { ModuleType } from '$lib/arktype'
import type { Module } from '../board/content/module'
import { GcClasses } from '../board/content/utils'
import type { Tile } from '../board/tile'
import { HarvestModule } from './harvest'
import { TransformModule } from './transform'
import { TransitModule } from './transit'

export const moduleClass = GcClasses(
	(def: Ssh.ModuleDefinition) =>
		({
			harvest: HarvestModule,
			transform: TransformModule,
			transit: TransitModule,
		})[def.action.type],
	modules,
) as Record<ModuleType, new (tile: Tile) => Module>

export * from './complex'
