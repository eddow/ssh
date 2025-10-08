import { type } from 'arktype'
// No JobPlan exports here anymore; plans are defined in plan.ts
import type { Character } from './population/character'

const jobTypes = ['harvest', 'transform', 'convey', 'offload', 'gather', 'construct'] as const

export interface Job {
	/** The job name offered at an alveolus */
	readonly type: (typeof jobTypes)[number]
	/** Estimated fatigue cost based on type + alveolus configuration */
	readonly fatigue: number
	/** Urgency level (1 = normal, higher = more urgent) */
	readonly urgency: number
}

export const JobType = type.enumerated(...jobTypes)
export function calculateJobScore(_character: Character, job: Job): number {
	return job.urgency
}
export function bestPossibleJobScore(_character: Character): number {
	return 3
}
