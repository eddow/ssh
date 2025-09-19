// GC-aware leak guard for allocation tokens
// Uses FinalizationRegistry to detect when an allocation token is garbage-collected
// without being fulfilled/cancelled, and logs the provided reason.

type Held = { reason: any }

const registry: FinalizationRegistry<Held> | null =
	typeof FinalizationRegistry !== 'undefined'
		? new FinalizationRegistry<Held>(({ reason }) => {
				try {
					// Surface the programming error clearly
					console.error('Leaked allocation (not fulfilled/cancelled):', reason)
				} catch {}
			})
		: null

// Track unregister tokens per allocation object
const tokens = new WeakMap<object, object>()

export function guardAllocation<Allocation extends object>(allocation: Allocation, reason: any) {
	if (!registry) return
	const token = {}
	tokens.set(allocation, token)
	registry.register(allocation, { reason }, token)
}

export function allocationEnded<Allocation extends object>(allocation: Allocation) {
	if (!registry) return
	const token = tokens.get(allocation)
	if (!token) return
	registry.unregister(token)
	tokens.delete(allocation)
}

export class AllocationError extends Error {
	constructor(message: string, public readonly reason: any) {
		super(message)
		this.name = 'AllocationError'
	}
}