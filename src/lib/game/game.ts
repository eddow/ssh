import Phaser from "phaser"
import type { TileXYType } from "phaser3-rex-plugins/plugins/board/types/Position"
import RexBoardPlugin from "phaser3-rex-plugins/plugins/board-plugin.js"
import type { AxialCoord } from "$lib/axial"
import { HexBoard, preloadTerrains } from "./hexboard"

export class LevelScene extends Phaser.Scene {
	declare rexBoard: RexBoardPlugin
	// null! to raise an exception if used before creation
	board: HexBoard = null!
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
		this.board = new HexBoard(this)
		this.board.on("tile-click", (pointer: any, coord: AxialCoord) => {
			console.log(`tile-click: ${coord.q},${coord.r}`)
		})
		this.board.on("gameobject-click", (gameObject: any) => {
			console.log(`gameobject-click: ${gameObject.tile}`)
		})

		// Setup mouse input for zoom and pan
		this.setupMouseInput()
		this.cameras.main.centerOn(0, 0)
	}

	private setupMouseInput() {
		// Middle mouse button for panning
		this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
			if (pointer.middleButtonDown()) {
				this.isPanning = true
				this.panStartPosition.x = pointer.x
				this.panStartPosition.y = pointer.y
				this.panStartCamera.x = this.cameras.main.scrollX
				this.panStartCamera.y = this.cameras.main.scrollY
				this.input.setDefaultCursor("grabbing")
			}
		})

		this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
			if (pointer.middleButtonReleased()) {
				this.isPanning = false
				this.input.setDefaultCursor("default")
			}
		})

		// Mouse wheel for zooming centered on pointer
		this.input.on(
			"wheel",
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

export class Game {
	public phaser: Phaser.Game
	public ground: LevelScene
	get board() {
		return this.ground.board
	}
	constructor() {
		this.phaser = new Phaser.Game({
			type: Phaser.AUTO,
			width: 800,
			height: 600,
			scene: LevelScene,
			plugins: {
				scene: [{ key: "rexboardPlugin", plugin: RexBoardPlugin, mapping: "rexBoard" }],
			},
		})
		this.ground = this.phaser.scene.getScene("GroundScene") as LevelScene
	}
	get camera() {
		return this.ground.cameras.main
	}
	public destroy() {
		this.phaser.destroy(true)
		this.phaser = null!
	}
}
