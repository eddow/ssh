import { AxialKeyMap, HeapMin } from "../mem"
import type { AxialCoord, AxialRef } from "./axial"
import { axial } from "./axial"

export type GetNeighbors = (coord: AxialRef) => (NeighborInfo | AxialCoord)[]
export type IsGoal<T> = (coord: AxialRef, walkTime: number) => T | false
export interface NeighborInfo {
	coord: AxialCoord
	walkTime: number
}

export interface PathfindingNode {
	coord: AxialCoord
	gCost: number // Time cost from start
	hCost: number // Heuristic cost to goal
	fCost?: number // Total cost (g + h) - calculated after creation
	parent?: AxialCoord
}

/**
 * A* pathfinding algorithm with time-based costs and maxTime limit
 * @param getNeighbors Function to get neighbors with walk times
 * @param start Starting coordinate
 * @param goal Target coordinate
 * @param maxTime Maximum walking time allowed for the path
 * @param punctual Whether to aim for the goal or a direct neighbor
 * @returns Path if found within maxTime, undefined otherwise
 */
export function findPath(
	getNeighbors: GetNeighbors,
	start: AxialRef,
	goal: AxialRef,
	maxTime: number,
	punctual: boolean = true,
): AxialCoord[] | undefined {
	const startCoord = axial.access(start)
	const goalCoord = axial.access(goal)
	const goalDistance = punctual ? 0 : 1

	// Initialize data structures
	const openSet = new HeapMin<AxialCoord, number>()
	const openSetMap = new AxialKeyMap<PathfindingNode>()
	const closedSet = new AxialKeyMap<PathfindingNode>()
	const gCosts = new AxialKeyMap<number>()
	const parentMap = new AxialKeyMap<AxialCoord>()

	// Initialize start node
	const startNode: PathfindingNode = {
		coord: startCoord,
		gCost: 0,
		hCost: heuristic(startCoord, goalCoord),
		fCost: 0,
	}
	startNode.fCost = startNode.gCost + startNode.hCost

	openSet.set(startCoord, startNode.fCost)
	openSetMap.set(startCoord, startNode)
	gCosts.set(startCoord, 0)

	while (!openSet.isEmpty) {
		// Get node with lowest fCost
		const currentCoord = openSet.pop()![0]
		const currentNode = openSetMap.get(currentCoord)!

		// Move to closed set
		closedSet.set(currentCoord, currentNode)
		openSetMap.delete(currentCoord)

		// Check if we reached the goal
		if (axial.distance(currentCoord, goalCoord) <= goalDistance) {
			return reconstructPath(goalCoord, startCoord, parentMap)
		}

		// Explore neighbors
		const neighbors = getNeighbors(currentCoord)
		for (const neighbor of neighbors) {
			const { coord: neighborCoord, walkTime } =
				"coord" in neighbor ? neighbor : { coord: neighbor, walkTime: 1 }

			// Skip if already in closed set
			if (closedSet.has(neighborCoord)) continue

			// Skip if tile is unwalkable
			if (walkTime === Number.POSITIVE_INFINITY) continue

			// Calculate tentative gCost
			const tentativeGCost = currentNode.gCost + walkTime

			// Skip if this path exceeds maxTime
			if (tentativeGCost > maxTime) continue

			// Check if this path to neighbor is better
			const existingGCost = gCosts.get(neighborCoord)
			if (existingGCost !== undefined && tentativeGCost >= existingGCost) continue

			// Create neighbor node
			const neighborNode: PathfindingNode = {
				coord: neighborCoord,
				gCost: tentativeGCost,
				hCost: heuristic(neighborCoord, goalCoord),
				parent: currentCoord,
			}
			neighborNode.fCost = neighborNode.gCost + neighborNode.hCost

			// Update costs and add to open set
			gCosts.set(neighborCoord, tentativeGCost)
			parentMap.set(neighborCoord, currentCoord)
			openSet.set(neighborCoord, neighborNode.fCost)
			openSetMap.set(neighborCoord, neighborNode)
		}
	}

	// No path found
	return undefined
}

/**
 * Heuristic function for hexagonal grid (Manhattan distance approximation)
 */
export function heuristic(a: AxialRef, b: AxialRef): number {
	return axial.distance(axial.access(a), axial.access(b))
}

/**
 * Reconstruct path from goal back to start using parent map
 */
function reconstructPath(
	goal: AxialCoord,
	start: AxialCoord,
	parentMap: AxialKeyMap<AxialCoord>,
): AxialCoord[] {
	const path: AxialCoord[] = []
	let current: AxialCoord = goal

	// Build path from goal to start
	while (current) {
		path.unshift(current)
		const parent = parentMap.get(current)
		if (!parent || axial.distance(parent, current) === 0) break
		current = parent
	}

	// Ensure start is included
	if (path.length === 0 || axial.distance(path[0], start) !== 0) {
		path.unshift(start)
	}

	return path
}

/**
 * Find the nearest coordinate that satisfies a condition within maxTime
 * @param getNeighbors Function to get neighbors with walk times
 * @param start Starting coordinate
 * @param isGoal Function that returns true if the coordinate is a valid goal
 * @param maxTime Maximum walking time allowed for the path
 * @param punctual Whether to aim for the goal or a direct neighbor
 * @returns Path to the nearest valid goal if found within maxTime, undefined otherwise
 */
export function findNearest<T>(
	getNeighbors: GetNeighbors,
	start: AxialRef,
	isGoal: IsGoal<true>,
	stop: number | ((coord: AxialRef, walkTime: number) => boolean),
	punctual: boolean = true,
): AxialCoord[] | undefined {
	const startCoord = axial.access(start)
	if(typeof stop === 'number')
		stop = ((stop)=> (_, walkTime: number) => walkTime > stop)(stop)
	// Check if start position already satisfies the goal condition
	if (isGoal(startCoord, 0)) return [startCoord]
	if (stop(startCoord, 0)) return undefined

	// Initialize data structures
	const openSet = new HeapMin<AxialCoord, number>()
	const openSetMap = new AxialKeyMap<PathfindingNode>()
	const closedSet = new AxialKeyMap<PathfindingNode>()
	const gCosts = new AxialKeyMap<number>()
	const parentMap = new AxialKeyMap<AxialCoord>()

	// Initialize start node
	const startNode: PathfindingNode = {
		coord: startCoord,
		gCost: 0,
		hCost: 0 // No heuristic for nearest search
	}
	startNode.fCost = startNode.gCost + startNode.hCost

	openSet.set(startCoord, startNode.fCost)
	openSetMap.set(startCoord, startNode)
	gCosts.set(startCoord, 0)

	while (!openSet.isEmpty) {
		// Get node with lowest fCost
		const currentCoord = openSet.pop()![0]
		const currentNode = openSetMap.get(currentCoord)!

		// Move to closed set
		closedSet.set(currentCoord, currentNode)
		openSetMap.delete(currentCoord)

		// Check if we reached a valid goal
		if (punctual && isGoal(currentCoord, currentNode.gCost)) {
			return reconstructPath(currentCoord, startCoord, parentMap)
		}

		// Explore neighbors
		const neighbors = getNeighbors(currentCoord)
		for (const neighbor of neighbors) {
			const { coord: neighborCoord, walkTime } =
				"coord" in neighbor ? neighbor : { coord: neighbor, walkTime: 1 }

			// Skip if tile is unwalkable
			if (!Number.isFinite(walkTime)) continue

			// Skip if already in closed set
			if (closedSet.has(neighborCoord)) continue
			if (!punctual && isGoal(neighborCoord, currentNode.gCost)) {
				return reconstructPath(currentCoord, startCoord, parentMap)
			}

			// Calculate tentative gCost
			const tentativeGCost = currentNode.gCost + walkTime

			// Skip if this path cannot be followed
			if (stop(neighborCoord, tentativeGCost)) continue

			// Check if this path to neighbor is better
			const existingGCost = gCosts.get(neighborCoord)
			if (existingGCost !== undefined && tentativeGCost >= existingGCost) continue

			// Create neighbor node
			const neighborNode: PathfindingNode = {
				coord: neighborCoord,
				gCost: tentativeGCost,
				hCost: 0, // No heuristic for nearest search
				parent: currentCoord,
			}
			neighborNode.fCost = neighborNode.gCost + neighborNode.hCost

			// Update costs and add to open set
			gCosts.set(neighborCoord, tentativeGCost)
			parentMap.set(neighborCoord, currentCoord)
			openSet.set(neighborCoord, neighborNode.fCost)
			openSetMap.set(neighborCoord, neighborNode)
		}
	}

	// No valid goal found within maxTime
	return undefined
}
