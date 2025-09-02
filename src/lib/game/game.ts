import Phaser from "phaser"
import type { TileXYType } from "phaser3-rex-plugins/plugins/board/types/Position"
import RexBoardPlugin from "phaser3-rex-plugins/plugins/board-plugin.js"
import { HexBoard, preloadTerrains } from "./hexboard"
import { getInteractiveObject, type InteractiveGameObject } from "./object"
import { Eventful } from "$lib/events"

const hexGames = new WeakMap<Phaser.Game, Game>()
export function hexGame(game: Phaser.Game) {
	return hexGames.get(game)!
}
export class LevelScene extends Phaser.Scene {
	declare rexBoard: RexBoardPlugin
	// null! to raise an exception if used before creation
	hex: HexBoard = null!
	tiles: TileXYType[] = null!
	// Panning properties
	private isPanning = false
	private panStartPosition = { x: 0, y: 0 }
	private panStartCamera = { x: 0, y: 0 }

	constructor() {
		super({ key: `GroundScene` })
	}

	preload() {
		this.load.setBaseURL(window.location.origin)
		preloadTerrains(this)
	}
	create() {
		this.hex = new HexBoard(hexGames.get(this.game)!, this)

		// Draw squares on tiles that have them
		this.hex.drawSquares(this)

		// Setup mouse input for zoom and pan
		this.setupMouseInput()
		this.cameras.main.centerOn(0, 0)
	}

	private setupMouseInput() {
		const Events = Phaser.Input.Events
		const game = hexGames.get(this.game)!
		// Middle mouse button for panning
		this.input.on(Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
			if (pointer.middleButtonDown()) {
				this.isPanning = true
				this.panStartPosition.x = pointer.x
				this.panStartPosition.y = pointer.y
				this.panStartCamera.x = this.cameras.main.scrollX
				this.panStartCamera.y = this.cameras.main.scrollY
				this.input.setDefaultCursor("grabbing")
			}
		})

		for(const [pEvt, cEvt] of [
			[Events.GAMEOBJECT_OVER, "objectOver"],
			[Events.GAMEOBJECT_OUT, "objectOut"],
			[Events.GAMEOBJECT_DOWN, "objectDown"],
			[Events.GAMEOBJECT_UP, "objectUp"],
		] as const)
			this.input.on(pEvt, (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, event: Phaser.Input.EventData) => {
				const interactiveObject = getInteractiveObject(gameObject)
				if(interactiveObject) game.emit(cEvt, pointer, interactiveObject, event.stopPropagation)
			})

		this.input.on(Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
			if (pointer.middleButtonReleased()) {
				this.isPanning = false
				this.input.setDefaultCursor("default")
			}
		})

		// Mouse wheel for zooming centered on pointer
		this.input.on(
			Events.POINTER_WHEEL,
			(
				_pointer: Phaser.Input.Pointer,
				_gameObjects: any[],
				_deltaX: number,
				deltaY: number,
				_deltaZ: number,
			) => {
				const zoomSpeed = 0.9
				const zoomDelta = zoomSpeed ** (deltaY / 120)
				const camera = this.cameras.main
				const newZoom = Math.max(0.1, Math.min(3, camera.zoom * zoomDelta))

				// Apply zoom first
				camera.setZoom(newZoom)
				//TODO: calculate scrollX += xxx(pointer.x) so that we keep the pointer at the same position
			},
		)
	}

	update(_time: number, _delta: number) {
		this.handleMousePanning()
	}

	private handleMousePanning() {
		const pointer = this.input.activePointer
		// Middle mouse button panning
		if (this.isPanning && pointer.middleButtonDown()) {
			const camera = this.cameras.main

			// Calculate the difference between current and start positions
			const deltaX = this.panStartPosition.x - pointer.x
			const deltaY = this.panStartPosition.y - pointer.y

			// Apply the pan offset to the camera
			camera.setScroll(
				this.panStartCamera.x + deltaX / camera.zoom,
				this.panStartCamera.y + deltaY / camera.zoom,
			)
		}
	}
}

export type GameEvents = {
	objectOver(pointer: Phaser.Input.Pointer, object: InteractiveGameObject, stopPropagation: () => void): void
	objectOut(pointer: Phaser.Input.Pointer, object: InteractiveGameObject, stopPropagation: () => void): void
	objectDown(pointer: Phaser.Input.Pointer, object: InteractiveGameObject, stopPropagation: () => void): void
	objectUp(pointer: Phaser.Input.Pointer, object: InteractiveGameObject, stopPropagation: () => void): void
	objectClick(pointer: Phaser.Input.Pointer, object: InteractiveGameObject, stopPropagation: () => void): void
}

export class Game extends Eventful<GameEvents> {
	public phaser: Phaser.Game

	private objects = new Map<string, InteractiveGameObject>()
	getObject(uid: string) {
		return this.objects.get(uid)
	}
	get ground() {
		return this.phaser.scene.getScene("GroundScene") as LevelScene
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
			plugins: {
				scene: [{ key: "rexboardPlugin", plugin: RexBoardPlugin, mapping: "rexBoard" }],
			},
		})
		hexGames.set(this.phaser, this)
	}
	get camera() {
		return this.ground.cameras.main
	}
	public destroy() {
		this.phaser.destroy(true)
		this.phaser = null!
	}
}
