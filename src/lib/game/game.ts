import { Eventful, reactive, unreactive, zip } from 'mutts/src'
import {
	Application,
	Assets,
	Container,
	Graphics,
	Point,
	Spritesheet,
	Texture,
	Ticker,
} from 'pixi.js'
import * as gameContent from '$assets/game-content'
import { prefix, resources } from '$assets/resources'
import { assert } from '$lib/debug'
import { interactionMode, mrg } from '$lib/globals.svelte'
import { registerPixiApp, unregisterPixiApp } from '$lib/hmr-pixi'
import { LCG } from '$lib/numbers'
import type { AlveolusType, DepositType, GoodType } from '$lib/types'
import { axial, axialRectangle, cartesian, fromCartesian } from '$lib/utils/axial'
import { toAxialCoord } from '$lib/utils/position'
import { tileSize } from '$lib/utils/varied'
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
	objectDrag(tiles: Tile[]): void
}
unreactive(Eventful)
export type GameGenerationOptions = {
	boardSize: number
	terrainSeed: number
	characterCount: number
	characterRadius?: number
}

export interface AlveolusPatch {
	coord: { q: number; r: number }
	goods?: Partial<Record<GoodType, number>>
	alveolus: AlveolusType
}

export interface TilePatch {
	coord: { q: number; r: number }
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
	freeGoods?: Array<{
		goodType: GoodType
		position: { q: number; r: number }
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
	public groundLayer: Container
	public alveoliLayer: Container
	public storedGoodsLayer: Container
	public freeGoodsLayer: Container
	public charactersLayer: Container
	public selectionOverlayLayer: Container
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
	public readonly ticker: Ticker
	private tickedObjects = new Set<{ update(deltaTime: number): void }>()
	public loaded: Promise<void>
	private async load() {
		this.resources = await assetsLoading
		this.ticker.start()
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

	registerTickedObject(object: { update(deltaTime: number): void }) {
		this.tickedObjects.add(object)
	}

	unregisterTickedObject(object: { update(deltaTime: number): void }) {
		this.tickedObjects.delete(object)
	}

	private tickerCallback = (timer: Ticker) => {
		const deltaTime = (25 * timer.elapsedMS) / 1000
		if (deltaTime > 1) return // more than 1 second = paused on debugging, skip passing time when debugger paused
		for (const object of this.tickedObjects) {
			if ('destroyed' in object && object.destroyed) continue
			object.update(deltaTime)
		}
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
		this.ticker = new Ticker()
		this.loaded = this.load()

		// Create layer structure (bottom to top)
		this.stage = new Container()
		this.groundLayer = new Container()
		this.alveoliLayer = new Container()
		this.storedGoodsLayer = new Container()
		this.freeGoodsLayer = new Container()
		this.charactersLayer = new Container()
		this.selectionOverlayLayer = new Container()

		// Disable sorting for ground layer (tiles stay in fixed order)
		this.groundLayer.sortableChildren = false
		// Other layers can have sorting enabled if needed
		this.alveoliLayer.sortableChildren = false
		this.storedGoodsLayer.sortableChildren = false
		this.freeGoodsLayer.sortableChildren = false
		this.charactersLayer.sortableChildren = true
		this.selectionOverlayLayer.sortableChildren = false

		// Add layers to stage in order (bottom to top)
		this.stage.addChild(this.groundLayer)
		this.stage.addChild(this.alveoliLayer)
		this.stage.addChild(this.storedGoodsLayer)
		this.stage.addChild(this.freeGoodsLayer)
		this.stage.addChild(this.charactersLayer)
		this.stage.addChild(this.selectionOverlayLayer)

		// Create hex board
		this.hex = new HexBoard(this)

		// Create population singleton
		this.population = new Population(this)

		// Create game generator
		this.generator = new GameGenerator()

		this.generate(this.generationOptions, this.patches)
		this.emit('gameStart')

		// Register the main ticker callback and start the game ticker after everything is built
		this.ticker.add(this.tickerCallback)
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
			if (patches.freeGoods?.length) this.applyFreeGoodsPatches(patches.freeGoods)
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

			const land = new UnBuiltLand(tile, tileInfo.terrain, deposit)
			// As generated state
			tile.asGenerated = true

			tile.content = land // Set the UnBuiltLand as tile content

			// Create initial goods at equilibrium levels
			for (const [goodType, amount] of Object.entries(tileInfo.goods)) {
				for (let i = 0; i < amount; i++) {
					// Generate random position within the tile using triangular distribution
					const u = Math.random()
					const v = Math.random()
					const q = (u - v) * 0.5
					const r = v - 0.5

					const randomPos = {
						q: tileInfo.coord.q + q,
						r: tileInfo.coord.r + r,
					}

					// Add the good to the free goods system
					this.hex.freeGoods.add(tile, goodType as any, randomPos)
				}
			}
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
				tile.asGenerated = false
			}
		}
	}

	private applyFreeGoodsPatches(patches: NonNullable<GamePatches['freeGoods']>) {
		for (const fg of patches) {
			const tile = this.hex.getTile(axial.round(fg.position))
			if (!tile) continue
			this.hex.freeGoods.add(tile, fg.goodType, fg.position)
		}
	}

	private applyHivesPatches(hives: NonNullable<GamePatches['hives']>) {
		for (const hive of hives) {
			let hiveInstance: Hive | undefined
			for (const a of hive.alveoli) {
				const tile = this.hex.getTile(a.coord)
				if (!tile) continue
				const AlveolusCtor = alveolusClass[a.alveolus as keyof typeof alveolusClass]
				if (!AlveolusCtor) continue
				const alv = new AlveolusCtor(tile)
				tile.content = alv
				hiveInstance = alv.hive
				alv.hive.name = hive.name
				if (a.goods)
					for (const [good, qty] of Object.entries(a.goods))
						alv.storage?.addGood(good as GoodType, qty)
				tile.asGenerated = false
			}
			assert(hiveInstance, 'Alveolus building on load')
		}
	}

	public saveGameData(): GamePatches {
		const tiles: Array<TilePatch> = []
		const hives = new Map<Hive, Array<AlveolusPatch>>()
		const freeGoodsPatches: GamePatches['freeGoods'] = []

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
					})
				} else if (content instanceof Alveolus) {
					// Assume alveolus-like content decorated by GcClassed with resourceName accessible via .name
					const alveolusName = content.name
					if (!hives.has(content.hive)) hives.set(content.hive, [])
					hives.get(content.hive)!.push({
						coord: { q, r },
						alveolus: alveolusName as AlveolusType,
						goods: content.storage?.stock || {},
					})
				}
			}
		}

		// Save all freeGoods with their exact positions
		const freeGoodsMap = (this.hex.freeGoods as any).goods as Map<
			string,
			Array<{ goodType: GoodType; position: { q: number; r: number } }>
		>
		for (const [, goodsList] of freeGoodsMap.entries()) {
			for (const fg of goodsList) {
				freeGoodsPatches!.push({
					goodType: fg.goodType,
					position: toAxialCoord(fg.position),
				})
			}
		}

		return {
			tiles,
			hives: Array.from(hives.entries()).map(([hive, alveoli]) => ({ name: hive.name, alveoli })),
			freeGoods: freeGoodsPatches,
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

	public destroy() {
		// Remove the ticker callback and stop the game ticker
		this.ticker.remove(this.tickerCallback)
		this.ticker.stop()
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
	// Drag selection properties
	private isDragging = false
	private dragStartWorld = { x: 0, y: 0 }
	private dragEndWorld = { x: 0, y: 0 }
	private selectionPreview?: Graphics

	/**
	 * Convert two world coordinate points into a list of tiles in axial selection
	 * @param startWorld Starting world coordinate point
	 * @param endWorld Ending world coordinate point
	 * @param game Game instance to get tiles from
	 * @returns Array of tiles in the selection
	 */
	private getTilesInSelection(
		startWorld: { x: number; y: number },
		endWorld: { x: number; y: number },
		game: Game,
	): Tile[] {
		// Convert world coordinates to axial coordinates
		const startAxial = axial.round(fromCartesian(startWorld, tileSize))
		const endAxial = axial.round(fromCartesian(endWorld, tileSize))

		// Get all axial coordinates in the selection
		const axialCoords = axialRectangle(startAxial, endAxial)

		// Convert to tiles
		const selectedTiles: Tile[] = []
		for (const coord of axialCoords) {
			const tile = game.hex.getTile(coord)
			if (tile) {
				selectedTiles.push(tile)
			}
		}

		return selectedTiles
	}

	private updateSelectionPreview(game: Game) {
		if (!this.isDragging) return

		// Clear previous preview
		if (this.selectionPreview) {
			game.selectionOverlayLayer.removeChild(this.selectionPreview)
			this.selectionPreview.destroy()
		}

		// Create new preview
		this.selectionPreview = new Graphics()

		// Convert world coordinates to axial coordinates
		const startAxial = axial.round(fromCartesian(this.dragStartWorld, tileSize))
		const endAxial = axial.round(fromCartesian(this.dragEndWorld, tileSize))

		// Get all axial coordinates in the selection
		const axialCoords = axialRectangle(startAxial, endAxial)

		// Draw outline for each tile in selection
		for (const coord of axialCoords) {
			const tile = game.hex.getTile(coord)
			if (tile) {
				const worldPos = cartesian(coord, tileSize)
				// Draw hexagon outline
				const points = Array.from({ length: 6 }, (_, i) => {
					const angle = (Math.PI / 3) * (i + 0.5)
					return new Point(
						worldPos.x + Math.cos(angle) * tileSize,
						worldPos.y + Math.sin(angle) * tileSize,
					)
				})
				this.selectionPreview.poly(points).stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
			}
		}

		game.selectionOverlayLayer.addChild(this.selectionPreview)
	}

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
			} else if (this.isDragging && e.buttons & 1) {
				// Left button drag for zoning - track rectangle
				const { x, y } = getCanvasPoint(e)
				const { x: wx, y: wy } = getWorldPoint(x, y)
				this.dragEndWorld = { x: wx, y: wy }
				this.updateSelectionPreview(game)
				const hit = topmostInteractiveAt(wx, wy)
				emitOverOutIfNeeded(hit, e)
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
			// Right-click cancels zoning drag
			if (e.button === 2 && this.isDragging) {
				// Clear selection preview
				if (this.selectionPreview) {
					game.selectionOverlayLayer.removeChild(this.selectionPreview)
					this.selectionPreview.destroy()
					this.selectionPreview = undefined
				}
				this.isDragging = false
				return
			}
			const { x, y } = getCanvasPoint(e)
			const { x: wx, y: wy } = getWorldPoint(x, y)
			const hit = topmostInteractiveAt(wx, wy)

			// Check if we're in zone mode for drag support (works even if no hit or hit is alveolus)
			if (e.button === 0 && interactionMode.selectedAction.startsWith('zone:')) {
				this.isDragging = true
				this.dragStartWorld = { x: wx, y: wy }
				this.dragEndWorld = { x: wx, y: wy }
				this.updateSelectionPreview(game)
				// Don't call clickObject in zone mode - we'll handle zoning on mouseup
				return
			}

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
			if (e.button === 0 && this.isDragging) {
				// End drag and find all tiles in the axial coordinate selection
				const selectedTiles = this.getTilesInSelection(this.dragStartWorld, this.dragEndWorld, game)

				// Emit event if at least one tile was selected
				if (selectedTiles.length >= 1) {
					game.emit('objectDrag', selectedTiles)
				}

				// Clear selection preview
				if (this.selectionPreview) {
					game.selectionOverlayLayer.removeChild(this.selectionPreview)
					this.selectionPreview.destroy()
					this.selectionPreview = undefined
				}

				this.isDragging = false
			}
		})

		// Prevent default context menu on right-click
		canvas.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})
	}
}
