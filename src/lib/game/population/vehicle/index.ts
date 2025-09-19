import type { Storage } from '../../storage'

export interface Vehicle extends Storage<any> {
	readonly character: any // Will be Character class
	readonly name: string
	// TODO: use it in displacement calculation. Note, it's not a multiplier as car*rough terrain = really slow
	readonly walkTime: number
	readonly debugInfo: Record<string, any>
	/**
	 * Check if this vehicle can perform the given action
	 * @param action - The action to check
	 * @returns true if the action can be performed
	 */
	canInteract?(action: string): boolean
	destroy?(): void
}
