import { modules } from '$assets/game-content'
import type { ModuleType } from '$lib/arktype'
import type { Tile } from '../../tile'
import { GcClasses } from '../utils'
import { HarvestModule } from './harvest'
import type { Module } from './module'
import { TransformModule } from './transform'
import { TransitModule } from './transit'

export * from './module'

export const moduleClass = GcClasses(
	(def: Ssh.ModuleDefinition) =>
		({
			harvest: HarvestModule,
			transform: TransformModule,
			transit: TransitModule,
		})[def.action.type],
	modules,
) as Record<ModuleType, new (tile: Tile) => Module>
