import { reactive } from 'mutts/src'
import { activityDurations } from '$assets/constants'
import { SlottedStorage } from '../../storage/slotted-storage'
import type { Vehicle } from './vehicle'

@reactive
export class ByHands extends SlottedStorage implements Vehicle {
	readonly character: any // Will be Character class
	readonly name = 'By Hands'
	readonly walkTime = activityDurations.footWalkTime
	readonly transferTime = activityDurations.handTransfer

	constructor(character: any) {
		super(3, 3) // 1 slot, max 1 quantity per slot
		this.character = character
	}

	canInteract(action: string): boolean {
		// By hands vehicle can't be built on
		if (action.startsWith('build:')) {
			return false
		}
		// For other actions, by hands might be able to act
		// This could be expanded based on vehicle state, etc.
		return false
	}

	get debugInfo(): Record<string, any> {
		return {
			name: this.name,
		}
	}
}
