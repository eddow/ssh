import { modules } from '$assets/game-content'
import { GcClasses } from '../utils'
import { HarvestModule } from './harvest'
import { TransformModule } from './transform'

export * from './module'

export const moduleClass = GcClasses(
	(def: Ssh.ModuleDefinition) =>
		({
			harvest: HarvestModule,
			transform: TransformModule,
		})[def.action.type],
	modules,
)
