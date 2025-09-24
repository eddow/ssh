/**
 * Board generation logic
 * Extracted from board/index.ts for better organization
 */

import { terrain as terrainDetails } from '$assets/game-content'
import type { DepositType, TerrainType } from '$lib/arktype'
import type { AxialCoord } from '$lib/hex'
import { axial } from '$lib/hex'
import { Deposit } from '../board/content/unbuilt-land'
import { TerrainGenerator } from './terrain'

export interface BoardGenerationConfig {
	boardSize: number
	terrainSeed: number
}

export interface GeneratedTileData {
	coord: AxialCoord
	terrain: TerrainType
	deposit?: GeneratedDepositData
	goods: Record<string, number>
	walkTime: number
}

export interface GeneratedDepositData {
	type: string
	amount: number
}

export class BoardGenerator {
	private terrainGenerator: TerrainGenerator

	constructor(private config: BoardGenerationConfig) {
		this.terrainGenerator = new TerrainGenerator({
			seed: config.terrainSeed,
		})
	}

	generateBoard(): GeneratedTileData[] {
		const tiles: GeneratedTileData[] = []

		for (const coord of axial.enum(this.config.boardSize - 1)) {
			const seed = this.coordSeed(coord)
			const terrain = this.terrainGenerator.generateTerrain(coord)
			const deposit = this.generateRandomDeposit(seed, terrain)
			const goods = this.generateRandomGoods(seed, terrain, deposit)

			tiles.push({
				coord,
				terrain,
				deposit,
				goods,
				walkTime: 3, // Default walk time for UnBuiltLand
			})
		}

		return tiles
	}

	private generateRandomGoods(
		seed: number,
		terrain: TerrainType,
		deposit: GeneratedDepositData | undefined,
	): Record<string, number> {
		const goods: Record<string, number> = {}

		// Create a simple RNG for this generation
		const rnd = this.createRNG(`goods-${seed}`)
		const details: Ssh.TerrainDefinition = terrainDetails[terrain]

		if (deposit) {
			// For now, we'll skip deposit-based goods generation since we don't have the full deposit object
			// This would need to be refactored to work with the deposit data structure
		}

		const ambient = details.generation?.goods ?? {}
		for (const [good, chance] of Object.entries(ambient)) {
			if (rnd() < (chance as number)) {
				goods[good] = (goods[good] || 0) + 1
			}
		}

		return goods
	}

	private generateRandomDeposit(
		seed: number,
		terrain: TerrainType,
	): GeneratedDepositData | undefined {
		const rnd = this.createRNG(`deposit+${seed}`)
		const details: Ssh.TerrainDefinition = terrainDetails[terrain]
		const table = details.generation?.deposits ?? {}

		for (const [depKey, chance] of Object.entries(table)) {
			if (rnd() < (chance as number)) {
				// Create deposit data instead of actual deposit object
				const Kind = Deposit.class[depKey as DepositType]
				const amount = Math.floor(((1 + rnd() * 2) * Kind.prototype.maxAmount) / 3)
				return {
					type: depKey,
					amount,
				}
			}
		}
		return undefined
	}

	private createRNG(seed: string): () => number {
		// Simple LCG implementation for generation
		let state = this.hashString(seed)
		return () => {
			state = (state * 1664525 + 1013904223) % 4294967296
			return state / 4294967296
		}
	}

	public coordSeed(coord: AxialCoord): number {
		return this.createRNG(`${coord.q},${coord.r}-${coord.q + coord.r}`)()
	}

	private hashString(str: string): number {
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return Math.abs(hash)
	}
}
