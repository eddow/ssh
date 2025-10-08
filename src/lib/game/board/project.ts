import { reactive } from 'mutts/src'
import type { AxialCoord } from '$lib/utils'
import { AxialKeyMap } from '$lib/utils/mem'

export abstract class Project {
	constructor(
		public readonly tiles: Set<string> = new Set(), // Set of axial keys
	) {}

	abstract get name(): string

	// Add a tile to this project
	addTile(coord: AxialCoord): void {
		const key = `${coord.q},${coord.r}`
		this.tiles.add(key)
	}

	// Remove a tile from this project
	removeTile(coord: AxialCoord): void {
		const key = `${coord.q},${coord.r}`
		this.tiles.delete(key)
	}

	// Check if a tile is part of this project
	hasTile(coord: AxialCoord): boolean {
		const key = `${coord.q},${coord.r}`
		return this.tiles.has(key)
	}

	// Get all coordinates in this project
	getCoords(): AxialCoord[] {
		return Array.from(this.tiles).map((key) => {
			const [q, r] = key.split(',').map(Number)
			return { q, r }
		})
	}
}

export class ConstructionProject extends Project {
	constructor(
		public readonly buildingType: string,
		tiles: Set<string> = new Set(),
	) {
		super(tiles)
	}

	get name(): string {
		return `Construction of ${this.buildingType}`
	}
}

export class ProjectManager {
	private readonly projects = reactive(new AxialKeyMap<Project>())

	// Add a project to a tile
	setProject(coord: AxialCoord, project: Project): void {
		this.projects.set(coord, project)
		project.addTile(coord)
	}

	// Get the project for a tile
	getProject(coord: AxialCoord): Project | undefined {
		return this.projects.get(coord)
	}

	// Remove a project from a tile
	removeProject(coord: AxialCoord): boolean {
		const project = this.projects.get(coord)
		if (project) {
			project.removeTile(coord)
		}
		return this.projects.delete(coord)
	}

	// Check if a tile has a project
	hasProject(coord: AxialCoord): boolean {
		return this.projects.has(coord)
	}

	// Get all projects
	getAllProjects(): { coord: AxialCoord; project: Project }[] {
		const result: { coord: AxialCoord; project: Project }[] = []
		for (const coord of this.projects.coords()) {
			const project = this.projects.get(coord)
			if (project) {
				result.push({ coord, project })
			}
		}
		return result
	}

	// Create a new construction project
	createConstructionProject(buildingType: string, tile: AxialCoord): ConstructionProject {
		const project = new ConstructionProject(buildingType)

		this.setProject(tile, project)

		return project
	}
}
