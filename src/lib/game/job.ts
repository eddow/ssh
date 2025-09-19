import { type } from 'arktype'
import type { Character } from './population'

export interface Job {
	/** The activity type from the module's action */
	readonly type: Ssh.Action['type']
	/** Estimated fatigue cost based on type + module configuration */
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
