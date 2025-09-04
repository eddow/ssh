import { Eventful, reactive, unreactive, zip } from "mutts"
import { Application, Assets, Container, Point, Spritesheet, Texture } from "pixi.js"
import * as gameContent from "$assets/game-content"
import { HexBoard } from "./hexboard"
import type { HittableGameObject, InteractiveGameObject } from "./object"

unreactive(gameContent)

const assetsToLoad = Object.entries(gameContent.resources)

const assetsLoading = Promise.all(
	assetsToLoad.map(([_, resource]) => Assets.load(`${gameContent.prefix}${resource}`)),
).then((assets) =>
	Object.fromEntries(
		zip(
			assetsToLoad.map(([key]) => key),
			assets,
		),
	),
)

export type GameEvents = {
	objectOver(pointer: any, object: InteractiveGameObject, stopPropagation?: () => void): void
	objectOut(pointer: any, object: InteractiveGameObject): void
	objectDown(pointer: any, object: InteractiveGameObject, stopPropagation?: () => void): void
	objectUp(pointer: any, object: InteractiveGameObject): void
	objectClick(pointer: any, object: InteractiveGameObject): void
}
export class Game extends Eventful<GameEvents> {
	public get name() {
		return "GameX"
	}
	public stage: Container
	public backgroundLayer: Container
	public objectLayer: Container
	public effectLayer: Container
	public resources: Record<string, Texture | Spritesheet> = null!
	getTexture(spec: Ssh.Sprite): Texture {
		if(!spec.startsWith("terrain-")) console.log("getTexture", spec)
		const rsc = this.resources[spec]
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
	private hex?: HexBoard
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

	get hexBoard() {
		return this.hex
	}

	constructor() {
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
	}
}

export class GameView {
	public pixi: Application
	public stage: Container
	constructor(
		public game: Game,
		into: HTMLElement,
	) {
		// Create PixiJS application
		this.pixi = new Application()
		this.stage = this.pixi.stage
		this.pixi
			.init({
				backgroundColor: 0x1099bb,
				resolution: window.devicePixelRatio || 1,
				autoDensity: true,
				//preference: "webgpu",
				resizeTo: into,
			})
			.then(() => {
				const canvas = this.pixi.canvas
				into.appendChild(canvas)
				this.setupInput(game, canvas)
			})
		this.stage.addChild(this.game.stage)
		//@ts-expect-error
		globalThis.__PIXI_APP__ = this.pixi
		//new Stats(this.pixi.renderer, document.body)
	}
	// Panning properties
	private isPanning = false
	private panStartPosition = { x: 0, y: 0 }
	private panStartCamera = { x: 0, y: 0 }
	public setupInput(game: Game, canvas: HTMLCanvasElement) {
		let hoveredObject: InteractiveGameObject | undefined
		let mouseDownObject: InteractiveGameObject | undefined

		const getCanvasPoint = (e: MouseEvent | WheelEvent) => {
			const rect = canvas.getBoundingClientRect()
			return { x: e.clientX - rect.left, y: e.clientY - rect.top }
		}

		const getWorldPoint = (x: number, y: number) => {
			const p = new Point(x, y)
			return this.stage.worldTransform.applyInverse(p)
		}

		const topmostInteractiveAt = (worldX: number, worldY: number) => {
			for (const interactive of game.hittableObjects) {
				const hit = interactive.hitTest(worldX, worldY)
				if (hit) return hit
			}
			return undefined
		}

		const emitOverOutIfNeeded = (nextHover: InteractiveGameObject | undefined, ev: MouseEvent) => {
			if (hoveredObject !== nextHover) {
				if (hoveredObject) {
					game.emit("objectOut", ev as any, hoveredObject)
				}
				if (nextHover) {
					game.emit("objectOver", ev as any, nextHover, () => {})
				}
				hoveredObject = nextHover
			}
		}

		canvas.addEventListener("mousemove", (e) => {
			if (this.isPanning && !(e.buttons & 4)) {
				// 4 = middle button
				this.isPanning = false
				canvas.style.cursor = "default"
			}
			// Pan while middle button down
			if (this.isPanning) {
				const deltaX = this.panStartPosition.x - e.offsetX
				const deltaY = this.panStartPosition.y - e.offsetY
				this.stage.x = this.panStartCamera.x - deltaX
				this.stage.y = this.panStartCamera.y - deltaY
			} else {
				const { x, y } = getCanvasPoint(e)
				const { x: wx, y: wy } = getWorldPoint(x, y)
				const hit = topmostInteractiveAt(wx, wy)
				emitOverOutIfNeeded(hit, e)
			}
		})

		canvas.addEventListener("mouseenter", (e) => {
			const { x, y } = getCanvasPoint(e)
			const { x: wx, y: wy } = getWorldPoint(x, y)
			const hit = topmostInteractiveAt(wx, wy)
			emitOverOutIfNeeded(hit, e)
		})

		const clearHover = (e: Event) => {
			if (hoveredObject) {
				game.emit("objectOut", e as any, hoveredObject)
				hoveredObject = undefined
			}
		}

		canvas.addEventListener("mouseleave", clearHover)
		window.addEventListener("blur", clearHover)
		window.addEventListener("mouseout", (e) => {
			if (!(e as MouseEvent).relatedTarget) clearHover(e)
		})

		canvas.addEventListener("mousedown", (e) => {
			if (e.button === 1) {
				this.isPanning = true
				this.panStartPosition.x = e.offsetX
				this.panStartPosition.y = e.offsetY
				this.panStartCamera.x = this.stage.x
				this.panStartCamera.y = this.stage.y
				canvas.style.cursor = "grab"
				return
			}
			const { x, y } = getCanvasPoint(e)
			const { x: wx, y: wy } = getWorldPoint(x, y)
			const hit = topmostInteractiveAt(wx, wy)
			mouseDownObject = hit
			if (hit) {
				let stopped = false
				const stop = () => {
					stopped = true
				}
				game.emit("objectDown", e as any, hit, stop)
				if (stopped) e.stopPropagation()
			}
		})

		canvas.addEventListener("mouseup", (e) => {
			if (e.button === 1) {
				this.isPanning = false
				canvas.style.cursor = "default"
				return
			}
			const { x, y } = getCanvasPoint(e)
			const { x: wx, y: wy } = getWorldPoint(x, y)
			const hit = topmostInteractiveAt(wx, wy)
			if (hit) {
				game.emit("objectUp", e as any, hit)
			}
			if (hit && hit === mouseDownObject) {
				game.emit("objectClick", e as any, hit)
			}
			mouseDownObject = undefined
		})

		canvas.addEventListener("wheel", (e) => {
			const deltaY = e.deltaY
			const zoomSpeed = 0.9
			const zoomDelta = zoomSpeed ** (deltaY / 120)
			const newZoom = Math.max(0.1, Math.min(3, this.stage.scale.x * zoomDelta))
			this.stage.scale.set(newZoom)
		})

		// Prevent default context menu on right-click
		canvas.addEventListener("contextmenu", (e) => {
			e.preventDefault()
		})
	}
}
