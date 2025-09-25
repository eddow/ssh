import { Eventful, reactive, unreactive, zip } from 'mutts'
import { Application, Assets, Container, Point, Spritesheet, Texture } from 'pixi.js'
import * as gameContent from '$assets/game-content'
import { prefix, resources } from '$assets/resources'
import type { AlveolusType, DepositType, GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { interactionMode, mrg } from '$lib/globals.svelte'
import { registerPixiApp, unregisterPixiApp } from '$lib/hmr-pixi'
import { LCG } from '$lib/numbers'
import { Alveolus } from './board'
import { HexBoard } from './board/board'
import { Deposit, UnBuiltLand } from './board/content/unbuilt-land'
import { Tile } from './board/tile'
import {
	type GameGenerationConfig,
	GameGenerator,
	type GeneratedCharacterData,
	type GeneratedTileData,
} from './generation'
import { alveolusClass, type Hive } from './hive'
import type { HittableGameObject, InteractiveGameObject } from './object'
import { Population } from './population/population'

unreactive(gameContent)

const assetsToLoad = Object.entries(resources)
export const assetUrls = Object.fromEntries(
	assetsToLoad.map(([key, resource]) => [key, `${prefix}${resource}`]),
)
const assetsLoading = Promise.all(
	assetsToLoad.map(async ([_, resource]) => {
		const texture = await Assets.load(`${prefix}${resource}`)
		if ('defaultAnchor' in texture) texture.defaultAnchor = { x: 0.5, y: 0.5 }
		return texture
	}),
).then((assets) =>
	Object.fromEntries(
		zip(
			assetsToLoad.map(([key]) => key),
			assets,
		),
	),
)

export type GameEvents = {
	gameStart(): void
	objectOver(pointer: any, object: InteractiveGameObject, stopPropagation?: () => void): void
	objectOut(pointer: any, object: InteractiveGameObject): void
	objectDown(pointer: any, object: InteractiveGameObject, stopPropagation?: () => void): void
	objectUp(pointer: any, object: InteractiveGameObject): void
	objectClick(pointer: any, object: InteractiveGameObject): void
}
unreactive(Eventful)
export type GameGenerationOptions = {
	boardSize: number
	terrainSeed: number
	characterCount: number
	characterRadius?: number
}

export interface TilePatchRoot {
	coord: { q: number; r: number }
	goods?: Partial<Record<GoodType, number>>
}

export interface AlveolusPatch extends TilePatchRoot {
	alveolus: AlveolusType
}

export interface TilePatch extends TilePatchRoot {
	deposit?: {
		type: DepositType
		amount: number
	}
}
export interface GamePatches {
	tiles?: Array<TilePatch>
	hives?: Array<{
		name?: string
		alveoli: Array<AlveolusPatch>
	}>
}

export class Game extends Eventful<GameEvents> {
	public get name() {
		return 'GameX'
	}
	public lcg(seed: string | number) {
		return LCG('gameSeed', seed)
	}
	public gameView?: GameView
	public stage: Container
	public backgroundLayer: Container
	public objectLayer: Container
	public effectLayer: Container
	public resources: Record<string, Texture | Spritesheet> = null!
	public readonly population: Population
	getTexture(spec: Ssh.Sprite): Texture {
		const ci = /(.*)\/(.*)/.exec(spec)

		if (!ci && this.resources[spec] instanceof Texture) return this.resources[spec] as Texture
		if (ci && this.resources[ci[1]] instanceof Spritesheet) {
			const ss = this.resources[ci[1]] as Spritesheet
			return ss.textures[ci[2]]
		}
		throw new Error(`Unknown sprite spec: ${JSON.stringify(spec)}`)
	}
	public readonly objects = reactive(new Map<string, InteractiveGameObject>())
	public readonly hittableObjects = new Set<HittableGameObject>()
	public readonly hex: HexBoard
	public readonly generator: GameGenerator
	public loaded: Promise<void>
	private async load() {
		this.resources = await assetsLoading
	}

	getObject(uid: string) {
		return this.objects.get(uid)
	}

	registerHittable(object: HittableGameObject) {
		this.hittableObjects.add(object)
	}
	unregisterHittable(object: HittableGameObject) {
		this.hittableObjects.delete(object)
	}

	register(object: InteractiveGameObject, uid?: string) {
		this.objects.set(uid ?? crypto.randomUUID(), object)
	}

	unregister(object: InteractiveGameObject) {
		this.objects.delete(object.uid)
		object.destroy()
	}

	constructor(
		private readonly generationOptions: GameGenerationOptions = {
			boardSize: 12,
			terrainSeed: 12345,
			characterCount: 1,
			characterRadius: 200,
		},
		private readonly patches: GamePatches = {},
	) {
		super()
		this.loaded = this.load()

		// Create layer structure
		this.stage = new Container()
		this.backgroundLayer = new Container()
		this.objectLayer = new Container()
		this.effectLayer = new Container()

		// Disable sorting for background layer (tiles stay in fixed order)
		this.backgroundLayer.sortableChildren = false
		// Enable sorting for object layer (objects sort by Y position)
		this.objectLayer.sortableChildren = true

		// Add layers to stage
		this.stage.addChild(this.backgroundLayer)
		this.stage.addChild(this.objectLayer)
		this.stage.addChild(this.effectLayer)

		// Create hex board
		this.hex = new HexBoard(this)

		// Create population singleton
		this.population = new Population(this)

		// Create game generator
		this.generator = new GameGenerator()

		this.generate(this.generationOptions, this.patches)
		this.emit('gameStart')
	}

	public simulateObjectClick(object: InteractiveGameObject) {
		this.emit('objectClick', {} as any, object)
	}
	generate(config: GameGenerationConfig, patches: GamePatches = {}) {
		try {
			// Generate data from the generator
			const result = this.generator.generate(config)

			// Load the generated data into the game
			this.loadGeneratedBoard(result.boardData)
			this.loadGeneratedPopulation(result.populationData)
			// Apply patches if any
			if (patches.tiles?.length) this.applyTilePatches(patches.tiles)
			if (patches.hives?.length) this.applyHivesPatches(patches.hives)
		} catch (error) {
			console.error('Generation failed:', error)
		}
	}
	clickObject(event: any, object: InteractiveGameObject) {
		this.emit('objectClick', event, object)
	}

	/**
	 * Load generated board data into the game
	 */
	private loadGeneratedBoard(tileData: GeneratedTileData[]): void {
		for (const tileInfo of tileData) {
			const tile = new Tile(this.hex, tileInfo.coord)

			// Create deposit if present
			let deposit: Deposit | undefined
			if (tileInfo.deposit) {
				const DepositClass = Deposit.class[tileInfo.deposit.type as keyof typeof Deposit.class]
				if (DepositClass) {
					deposit = new DepositClass(tileInfo.deposit.amount)
				}
			}

			const land = new UnBuiltLand(tile, tileInfo.walkTime, tileInfo.terrain, deposit)
			// As generated state
			tile.asGenerated = true

			// Add goods to the land
			for (const [good, amount] of Object.entries(tileInfo.goods)) {
				const numAmount = amount as number
				for (let i = 0; i < numAmount; i++) {
					land.addGood(good as any, 1)
				}
			}

			tile.content = land
		}
	}

	private applyTilePatches(patches: NonNullable<GamePatches['tiles']>) {
		for (const p of patches) {
			const tile = this.hex.getTile(p.coord)
			if (!tile) continue
			const content = tile.content
			if (content instanceof UnBuiltLand) {
				if (p.deposit) {
					const DepositClass = Deposit.class[p.deposit.type as keyof typeof Deposit.class]
					if (DepositClass) content.deposit = new DepositClass(p.deposit.amount)
				}
				if (p.goods)
					for (const [good, qty] of Object.entries(p.goods)) content.addGood(good as GoodType, qty)
				tile.asGenerated = false
			}
		}
	}

	private applyHivesPatches(hives: NonNullable<GamePatches['hives']>) {
		for (const hive of hives) {
			for (const a of hive.alveoli) {
				const tile = this.hex.getTile(a.coord)
				if (!tile) continue
				const AlveolusCtor = alveolusClass[a.alveolus as keyof typeof alveolusClass]
				if (!AlveolusCtor) continue
				const alv = new AlveolusCtor(tile)
				assert(alv.hive, 'Alveolus building on load')
				alv.hive.name = hive.name
				if (a.goods)
					for (const [good, qty] of Object.entries(a.goods)) alv.addGood(good as GoodType, qty)
				tile.content = alv
				tile.asGenerated = false
			}
		}
	}

	public saveGameData(): GamePatches {
		const tiles: Array<TilePatch> = []
		const hives = new Map<Hive, Array<AlveolusPatch>>()
		// Enumerate using hex board contents map by sampling existing tiles
		for (let q = -this.hex.boardSize; q <= this.hex.boardSize; q++) {
			for (let r = -this.hex.boardSize; r <= this.hex.boardSize; r++) {
				const tile = this.hex.getTile({ q, r })
				if (!tile || tile.asGenerated) continue
				const content = tile.content
				if (!content) continue
				// Serialize minimal content state
				if (content instanceof UnBuiltLand) {
					tiles.push({
						coord: { q, r },
						deposit: content.deposit
							? {
									type:
										(content.deposit.constructor as any).key ??
										(content.deposit.constructor as any).name,
									amount: content.deposit.amount,
								}
							: undefined,
						goods: content.stock,
					})
				} else if (content instanceof Alveolus) {
					// Assume alveolus-like content decorated by GcClassed with resourceName accessible via .name
					const alveolusName = content.name
					if (!hives.has(content.hive)) hives.set(content.hive, [])
					hives.get(content.hive)!.push({
						coord: { q, r },
						alveolus: alveolusName as AlveolusType,
						goods: content.stock,
					})
				}
			}
		}
		return {
			tiles,
			hives: Array.from(hives.entries()).map(([hive, alveoli]) => ({ name: hive.name, alveoli })),
		}
	}

	/**
	 * Load generated population data into the game
	 */
	private loadGeneratedPopulation(characterData: GeneratedCharacterData[]): void {
		for (const charInfo of characterData) {
			this.population.createCharacter(charInfo.name, charInfo.coord)
		}
	}

	/**
	 * Transform seconds to game time
	 * Centralization of time management (speed-up, pause, etc.)
	 * @param seconds seconds to transform
	 * @returns
	 */
	transformTime(seconds: number) {
		if (seconds > 1) return 0
		return seconds * 5
	}
}

export class GameView {
	public pixi!: Application
	public stage!: Container
	private container: HTMLElement
	private canvas: HTMLCanvasElement | null = null

	constructor(
		public game: Game,
		into: HTMLElement,
	) {
		this.game.gameView ??= this
		this.container = into
		this.initializePixi()
	}

	private async initializePixi() {
		// Create PixiJS application
		this.pixi = new Application()
		this.stage = this.pixi.stage

		await this.pixi.init({
			backgroundColor: 0x1099bb,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true,
			//preference: "webgpu",
			resizeTo: this.container,
		})

		this.canvas = this.pixi.canvas
		this.container.appendChild(this.canvas)
		this.setupInput(this.game, this.canvas)
		this.stage.addChild(this.game.stage)

		// Register for HMR cleanup
		registerPixiApp(this.pixi)

		//@ts-expect-error
		globalThis.__PIXI_APP__ = this.pixi
		//new Stats(this.pixi.renderer, document.body)
	}

	public destroy() {
		// Unregister from HMR cleanup
		if (this.pixi) {
			unregisterPixiApp(this.pixi)
		}

		// Remove canvas from DOM
		if (this.canvas?.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas)
		}

		// Destroy PixiJS application
		if (this.pixi) {
			this.pixi.destroy({
				removeView: false,
				releaseGlobalResources: true,
			})
		}

		// Clear global reference
		//@ts-expect-error
		if (globalThis.__PIXI_APP__ === this.pixi) {
			//@ts-expect-error
			globalThis.__PIXI_APP__ = null
		}

		this.canvas = null
	}

	public async reload() {
		this.destroy()
		await this.initializePixi()
	}
	// Panning properties
	private isPanning = false
	private panStartPosition = { x: 0, y: 0 }
	private panStartCamera = { x: 0, y: 0 }
	public setupInput(game: Game, canvas: HTMLCanvasElement) {
		const getCanvasPoint = (e: MouseEvent | WheelEvent) => {
			return { x: e.offsetX, y: e.offsetY }
		}

		const getWorldPoint = (x: number, y: number) => {
			const p = new Point(x, y)
			return this.stage.worldTransform.applyInverse(p)
		}

		const topmostInteractiveAt = (worldX: number, worldY: number) => {
			// Sort hittable objects by zIndex (highest first)
			const sortedHittables = Array.from(game.hittableObjects).sort((a, b) => b.zIndex - a.zIndex)

			for (const interactive of sortedHittables) {
				const hit = interactive.hitTest(
					worldX,
					worldY,
					interactionMode.selectedAction === 'select' ? undefined : interactionMode.selectedAction,
				)
				if (hit) return hit
			}
			return undefined
		}

		const emitOverOutIfNeeded = (nextHover: InteractiveGameObject | undefined, _ev: MouseEvent) => {
			if (mrg.hoveredObject !== nextHover) {
				/*
				if (mrg.hoveredObject) {
					game.emit("objectOut", ev as any, mrg.hoveredObject)
				}
				if (nextHover) {
					game.emit("objectOver", ev as any, nextHover, () => {})
				}*/
				mrg.hoveredObject = nextHover
			}
		}

		canvas.addEventListener('mousemove', (e) => {
			if (this.isPanning && !(e.buttons & 4)) {
				// 4 = middle button
				this.isPanning = false
				canvas.style.cursor = 'default'
			}
			// Pan while middle button down
			if (this.isPanning) {
				const deltaX = this.panStartPosition.x - e.offsetX
				const deltaY = this.panStartPosition.y - e.offsetY
				this.stage.x = this.panStartCamera.x - deltaX
				this.stage.y = this.panStartCamera.y - deltaY
				//console.log(this.stage.x, this.stage.y)
			} else {
				const { x, y } = getCanvasPoint(e)
				const { x: wx, y: wy } = getWorldPoint(x, y)
				const hit = topmostInteractiveAt(wx, wy)
				emitOverOutIfNeeded(hit, e)
			}
		})

		canvas.addEventListener(
			'wheel',
			(e) => {
				// Prevent page scroll while zooming the canvas
				e.preventDefault()

				const zoomSpeed = 0.9
				const zoomDelta = zoomSpeed ** (e.deltaY / 120)
				const newZoom = Math.max(0.1, Math.min(3, this.stage.scale.x * zoomDelta))
				if (newZoom === this.stage.scale.x) return
				const s = this.stage.scale.x
				const tx = (e.offsetX - this.stage.x) / s
				const ty = (e.offsetY - this.stage.y) / s
				// Apply new scale and adjust position so the mouse point stays fixed
				this.stage.scale.set(newZoom)
				this.stage.x = e.offsetX - tx * newZoom
				this.stage.y = e.offsetY - ty * newZoom
			},
			{ passive: false },
		)

		canvas.addEventListener('mouseenter', (e) => {
			const { x, y } = getCanvasPoint(e)
			const { x: wx, y: wy } = getWorldPoint(x, y)
			const hit = topmostInteractiveAt(wx, wy)
			emitOverOutIfNeeded(hit, e)
		})

		const clearHover = (_e: Event) => {
			if (mrg.hoveredObject) {
				//game.emit("objectOut", e as any, mrg.hoveredObject)
				mrg.hoveredObject = undefined
			}
		}

		canvas.addEventListener('mouseleave', clearHover)
		window.addEventListener('blur', clearHover)
		window.addEventListener('mouseout', (e) => {
			if (!(e as MouseEvent).relatedTarget) clearHover(e)
		})

		canvas.addEventListener('mousedown', (e) => {
			if (e.button === 1) {
				this.isPanning = true
				this.panStartPosition.x = e.offsetX
				this.panStartPosition.y = e.offsetY
				this.panStartCamera.x = this.stage.x
				this.panStartCamera.y = this.stage.y
				canvas.style.cursor = 'grab'
				return
			}
			const { x, y } = getCanvasPoint(e)
			const { x: wx, y: wy } = getWorldPoint(x, y)
			const hit = topmostInteractiveAt(wx, wy)
			if (hit) {
				game.clickObject(e, hit)
			}
		})

		canvas.addEventListener('mouseup', (e) => {
			if (e.button === 1) {
				this.isPanning = false
				canvas.style.cursor = 'default'
				return
			}
		})

		// Prevent default context menu on right-click
		canvas.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})
	}
}
