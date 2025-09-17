export interface Job {
	/** The activity type from the module's action */
	readonly type: Ssh.Action['type']
	/** Estimated fatigue cost based on type + module configuration */
	readonly fatigue: number
	/** Urgency level (1 = normal, higher = more urgent) */
	readonly urgency: number
}

export interface JobProvider {
	/** Get available job if any, undefined if no job available */
	getJob(): Job | undefined
}
