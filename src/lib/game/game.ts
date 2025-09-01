import Phaser from "phaser"
import { HexBoard } from "./hexboard"
import RexBoardPlugin from 'phaser3-rex-plugins/plugins/board-plugin.js'
import type { TileXYType } from "phaser3-rex-plugins/plugins/board/types/Position"
import type Board from "phaser3-rex-plugins/plugins/board/board/LogicBoard"
import type { AxialCoord } from "$lib/axial"

export class LevelScene extends Phaser.Scene {
	declare rexBoard: RexBoardPlugin
	// null! to raise an exception if used before creation
	board: HexBoard = null!
	tiles: TileXYType[] = null!
	
	// Navigation properties
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
	private wasdKeys!: {
		w: Phaser.Input.Keyboard.Key
		a: Phaser.Input.Keyboard.Key
		s: Phaser.Input.Keyboard.Key
		d: Phaser.Input.Keyboard.Key
	}
	private navigationSpeed = 300 // pixels per second
	
	// Panning properties
	private isPanning = false
	private panStartPosition = { x: 0, y: 0 }
	private panStartCamera = { x: 0, y: 0 }
	
	constructor() {
		super({ key: `GroundScene` })
	}

	preload() {
		this.load.setBaseURL("https://labs.phaser.io")
		this.load.image("sky", "assets/skies/space3.png")
		this.load.image("logo", "assets/sprites/phaser3-logo.png")
		this.load.image("red", "assets/particles/red.png")
	}
	create() {
		this.board = new HexBoard(this)
		this.board.on('tile-click', (pointer: any, coord: AxialCoord) => {
			console.log(`tile-click: ${coord.q},${coord.r}`)
		})
		this.board.on('gameobject-click', (gameObject: any) => {
			console.log(`gameobject-click: ${gameObject.tile}`)
		})
		
		// Setup keyboard input
		this.setupKeyboardInput()
		
		// Setup mouse input for zoom and pan
		this.setupMouseInput()
		this.cameras.main.centerOn(0, 0)
	}
	
	private setupKeyboardInput() {
		// Setup cursor keys (arrow keys)
		this.cursors = this.input.keyboard!.createCursorKeys()
		
		// Setup WASD keys
		this.wasdKeys = this.input.keyboard!.addKeys({
			w: Phaser.Input.Keyboard.KeyCodes.W,
			a: Phaser.Input.Keyboard.KeyCodes.A,
			s: Phaser.Input.Keyboard.KeyCodes.S,
			d: Phaser.Input.Keyboard.KeyCodes.D
		}) as any
	}
	
	private setupMouseInput() {
		// Middle mouse button for panning
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (pointer.middleButtonDown()) {
				this.isPanning = true
				this.panStartPosition.x = pointer.x
				this.panStartPosition.y = pointer.y
				this.panStartCamera.x = this.cameras.main.scrollX
				this.panStartCamera.y = this.cameras.main.scrollY
				this.input.setDefaultCursor('grabbing')
			}
		})
		
		this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
			if (pointer.middleButtonReleased()) {
				this.isPanning = false
				this.input.setDefaultCursor('default')
			}
		})
		
		// Mouse wheel for zooming centered on pointer
		this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any[], deltaX: number, deltaY: number, deltaZ: number) => {
			const zoomSpeed = .9
			const zoomDelta = Math.pow(zoomSpeed, deltaY/120)
			const camera = this.cameras.main
			const newZoom = Math.max(0.1, Math.min(3, camera.zoom * zoomDelta))
			
			// Apply zoom first
			camera.setZoom(newZoom)
			//TODO: calculate scrollX += xxx(pointer.x) so that we keep the pointer at the same position
		})
	}
	
	update(time: number, delta: number) {
		this.handleKeyboardNavigation(delta)
		this.handleMousePanning()
	}
	
	private handleKeyboardNavigation(delta: number) {
		const camera = this.cameras.main
		const speed = (this.navigationSpeed * delta) / 1000
		
		// Handle WASD keys
		if (this.wasdKeys.w.isDown) {
			camera.scrollY -= speed
		}
		if (this.wasdKeys.s.isDown) {
			camera.scrollY += speed
		}
		if (this.wasdKeys.a.isDown) {
			camera.scrollX -= speed
		}
		if (this.wasdKeys.d.isDown) {
			camera.scrollX += speed
		}
		
		// Handle arrow keys (alternative to WASD)
		if (this.cursors.up.isDown) {
			camera.scrollY -= speed
		}
		if (this.cursors.down.isDown) {
			camera.scrollY += speed
		}
		if (this.cursors.left.isDown) {
			camera.scrollX -= speed
		}
		if (this.cursors.right.isDown) {
			camera.scrollX += speed
		}
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
				this.panStartCamera.x + deltaX/camera.zoom,
				this.panStartCamera.y + deltaY/camera.zoom
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
				scene: [{ key: 'rexboardPlugin', plugin: RexBoardPlugin, mapping: 'rexBoard' }]
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