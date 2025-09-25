import { type } from 'arktype'
import type { Character } from './population/character'

export interface Job {
	/** The job name offered at an alveolus */
	readonly type: 'harvest' | 'transform' | 'convey' | 'gather'
	/** Estimated fatigue cost based on type + alveolus configuration */
	readonly fatigue: number
	/** Urgency level (1 = normal, higher = more urgent) */
	readonly urgency: number
}

export const JobType = type.enumerated('harvest', 'transform', 'convey', 'gather')
export function calculateJobScore(_character: Character, job: Job): number {
	return job.urgency
}
export function bestPossibleJobScore(_character: Character): number {
	return 3
}
