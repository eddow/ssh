import { scope, type } from 'arktype'
import { TileBorder } from '$lib/game/board/border/border'
import { Alveolus } from '$lib/game/board/content/alveolus'
import { TileContent } from '$lib/game/board/content/content'
import { Tile } from '$lib/game/board/tile'
import { BuildAlveolus } from '$lib/game/hive/build'
import { EngineerAlveolus } from '$lib/game/hive/engineer'
import { GatherAlveolus } from '$lib/game/hive/gather'
import { HarvestAlveolus } from '$lib/game/hive/harvest'
import { baseGameScope } from './base'

/**
 * Game Objects Module
 *
 * Defines type validators for game object classes using type.instanceOf().
 * This module can be imported by domain scopes that need to reference game objects.
 */


// Helper for robust instance checking (handles dual-package hazards in dev)
const instance = <T extends abstract new (...args: any[]) => any>(cls: T) => 
    type('object').narrow((data): data is InstanceType<T> => 
        data instanceof cls || (!!data && (data as any).constructor?.name === cls.name)
    )

export const gameObjectsModule = scope({
	...baseGameScope.export(),
	Tile: instance(Tile),
	TileBorder: instance(TileBorder),
	TileContent: instance(TileContent),
	Alveolus: instance(Alveolus),
	HarvestAlveolus: instance(HarvestAlveolus),
	GatherAlveolus: instance(GatherAlveolus),
	EngineerAlveolus: instance(EngineerAlveolus),
	BuildAlveolus: instance(BuildAlveolus),
}).export()
