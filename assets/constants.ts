// Gameplay mechanics constants
// These control character behavior, survival mechanics, and game balance

export const characterEvolutionRates: {[k in Ssh.NeedType]: Partial<Record<Ssh.ActivityType, number>> & { '*': number }} = {
	// Need evolution per activity, with '*' as default fallback
	hunger: {
		'*': 2,
		walk: 8,
		work: 12,
		eat: 0,
	} as const,
	tiredness: {
		'*': 2,
		walk: 5,
		work: 8,
		sleep: 0,
	} as const,
	fatigue: {
		'*': 0,
		walk: 3,
		work: 5,
	} as const,
} as const

export const characterTriggerLevels = {
	hunger: {
		high: 700,
		critical: 1000,
		satisfied: 300,
	},
	tiredness: {
		high: 2100,
		critical: 2500,
		satisfied: 100,
	},
	fatigue: {
		high: 140,
		critical: 180,
		satisfied: 10,
	},
} as const

export const activityDurations = {
	transfer: 0.5,        // Time to grab/drop items
	eating: 2,            // Time to eat food
	restMin: 3,
	restMax: 6,
} as const

export const ponderingFatigueRecovery = 60  // Fatigue recovery rate while resting
export const maxWalkTime = 24	// Maximum walking time accepted to choose a tile for an action