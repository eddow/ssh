import Phaser from "phaser"
import { Eventful } from "$lib/events"
import { HexBoard, preloadTerrains } from "./hexboard"
import type { InteractiveGameObject } from "./object"

const hexGames = new WeakMap<Phaser.Game, Game>()
export function hexGame(game: Phaser.Game) {
	return hexGames.get(game)!
}
export class LevelScene extends Phaser.Scene {
	// null! to raise an exception if used before creation
	hex: HexBoard = null!

	constructor() {
		super({ key: `GroundScene` })
	}

	preload() {
		this.load.setBaseURL(window.location.origin)
		preloadTerrains(this)
	}
	create() {
		const game = hexGames.get(this.game)!
		this.hex = new HexBoard(game)

		// Delegate input setup to Game and attach scene
		game.attachScene(this)
		game.setupInput(this)

		// Draw squares on tiles that have them
		this.hex.drawSquares(this)
		this.cameras.main.centerOn(0, 0)
	}

	update(_time: number, _delta: number) {
		// Input panning handled in setupInput mousemove handler
	}
}

export type GameEvents = {
	objectOver(pointer: any, object: InteractiveGameObject, stopPropagation?: () => void): void
	objectOut(pointer: any, object: InteractiveGameObject): void
	objectDown(pointer: any, object: InteractiveGameObject, stopPropagation: () => void): void
	objectUp(pointer: any, object: InteractiveGameObject): void
	objectClick(pointer: any, object: InteractiveGameObject): void
}

export class Game extends Eventful<GameEvents> {
	public phaser: Phaser.Game
	// Panning properties (managed at Game-level)
	private isPanning = false
	private panStartPosition = { x: 0, y: 0 }
	private panStartCamera = { x: 0, y: 0 }
	private scene?: LevelScene

	private objects = new Map<string, InteractiveGameObject>()
	getObject(uid: string) {
		return this.objects.get(uid)
	}
	get ground() {
		return this.scene ?? (this.phaser.scene.getScene("GroundScene") as LevelScene)
	}
	get hex() {
		return this.ground.hex
	}
	constructor() {
		super()
		this.phaser = new Phaser.Game({
			type: Phaser.AUTO,
			width: 800,
			height: 600,
			scene: LevelScene,
		})
		hexGames.set(this.phaser, this)
	}
	get camera() {
		return this.ground.cameras.main
	}
	public register(object: InteractiveGameObject) {
		this.objects.set(object.uid, object)
		if (this.scene) object.addToScene(this.scene)
	}
	public unregister(uidOrObject: string | InteractiveGameObject) {
		const obj = typeof uidOrObject === "string" ? this.objects.get(uidOrObject) : uidOrObject
		if (!obj) return
		obj.remove()
		this.objects.delete(obj.uid)
	}
	public attachScene(scene: LevelScene) {
		this.scene = scene
		for (const obj of this.objects.values()) obj.addToScene(scene)
	}
	public detachScene() {
		this.scene = undefined
	}
	public setupInput(scene: LevelScene) {
		const canvas = this.phaser.canvas
		const camera = scene.cameras.main
		let hoveredObject: InteractiveGameObject | undefined
		let mouseDownObject: InteractiveGameObject | undefined

		const getCanvasPoint = (e: MouseEvent | WheelEvent) => {
			const rect = canvas.getBoundingClientRect()
			return { x: e.clientX - rect.left, y: e.clientY - rect.top }
		}
		const getWorldPoint = (x: number, y: number) => {
			const p = camera.getWorldPoint(x, y)
			return { x: p.x, y: p.y }
		}
		const objects = () => Array.from(this.objects.values())
		const topmostInteractiveAt = (worldX: number, worldY: number) => {
			const list = objects()
			for (let i = list.length - 1; i >= 0; i--) {
				const interactive = list[i]
				const obj = interactive.getRenderedObject()
				if (!obj || !(obj as any).visible || !(obj as any).active) continue

				// Use the object's own hitTest method
				const hit = interactive.hitTest(worldX, worldY)
				if (hit) return hit
			}
			return undefined
		}
		const emitOverOutIfNeeded = (nextHover: InteractiveGameObject | undefined, ev: MouseEvent) => {
			if (hoveredObject !== nextHover) {
				if (hoveredObject) {
					this.emit("objectOut", ev as any, hoveredObject)
				}
				if (nextHover) {
					this.emit("objectOver", ev as any, nextHover, () => {})
				}
				hoveredObject = nextHover
			}
		}

		canvas.addEventListener("mousemove", (e) => {
			// Pan while middle button down
			if (this.isPanning) {
				const pointer = scene.input.activePointer
				const deltaX = this.panStartPosition.x - pointer.x
				const deltaY = this.panStartPosition.y - pointer.y
				camera.setScroll(
					this.panStartCamera.x + deltaX / camera.zoom,
					this.panStartCamera.y + deltaY / camera.zoom,
				)
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
				this.emit("objectOut", e as any, hoveredObject)
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
				this.panStartCamera.x = camera.scrollX
				this.panStartCamera.y = camera.scrollY
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
				this.emit("objectDown", e as any, hit, stop)
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
				this.emit("objectUp", e as any, hit)
			}
			if (hit && hit === mouseDownObject) {
				this.emit("objectClick", e as any, hit)
			}
			mouseDownObject = undefined
		})

		canvas.addEventListener("wheel", (e) => {
			const deltaY = e.deltaY
			const zoomSpeed = 0.9
			const zoomDelta = zoomSpeed ** (deltaY / 120)
			const newZoom = Math.max(0.1, Math.min(3, camera.zoom * zoomDelta))
			camera.setZoom(newZoom)
		})

		// Prevent default context menu on right-click
		canvas.addEventListener("contextmenu", (e) => {
			e.preventDefault()
		})
	}
	public destroy() {
		this.phaser.destroy(true)
		this.phaser = null!
	}
}
