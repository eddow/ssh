<script lang="ts">
import { type Game } from '$lib/game'

const props = $props<{
	game: Game
	sprite: Ssh.Sprite
	width?: number
	height?: number
	alt?: string
	className?: string
}>()
let { game, sprite, width, height, alt = '', className = '' } = props

let inlineStyle = $state('')

const computeStyleFromTexture = (texture: any) => {
	if (!texture) return ''
	// Source URL (resource.src doesn't work, resource._sourceOrigin is well set but "private", label seems to work)
	const src: string | undefined = texture?.source?.resource?.src ?? texture?.source?.label
	if (!src) return ''
	const frame = texture?.frame ?? {
		x: 0,
		y: 0,
		width: texture?.width ?? 0,
		height: texture?.height ?? 0,
	}
	const realWidth = frame?.width ?? texture?.width ?? 0
	const realHeight = frame?.height ?? texture?.height ?? 0
	const givenHeight = height !== undefined
	const givenWidth = width !== undefined
	if (givenHeight !== givenWidth) {
		if (givenHeight) {
			width = (height * realWidth) / realHeight
		} else {
			height = (width * realHeight) / realWidth
		}
	}
	// Target box (div size)
	const targetW = width ?? frame?.width ?? texture?.width ?? 0
	const targetH = height ?? frame?.height ?? texture?.height ?? 0
	// Source image pixel size and resolution
	const res: number = texture?.source?.resolution ?? 1
	const sourcePixelW: number = texture?.source?.pixelWidth ?? (texture?.source?.width ?? 0) * res
	const sourcePixelH: number = texture?.source?.pixelHeight ?? (texture?.source?.height ?? 0) * res
	// Fit scale so frame fits inside target maintaining aspect ratio
	const fitScale = Math.min(
		targetW / Math.max(1, frame?.width || 0),
		targetH / Math.max(1, frame?.height || 0),
	)
	// Background-size scales the entire source image
	const bgScale = fitScale / res
	const bgW = sourcePixelW * bgScale
	const bgH = sourcePixelH * bgScale
	// Position to show the frame origin at top-left of the box
	const posX = -((frame?.x || 0) * fitScale)
	const posY = -((frame?.y || 0) * fitScale)

	return [
		`width: ${targetW}px;`,
		`height: ${targetH}px;`,
		`background-image: url(${JSON.stringify(src)});`,
		`background-position: ${posX}px ${posY}px;`,
		`background-size: ${bgW}px ${bgH}px;`,
		'background-repeat: no-repeat;',
		'image-rendering: pixelated;',
	].join(' ')
}

$effect(() => {
	if (!game || !sprite) {
		inlineStyle = ''
		return
	}
	;(async () => {
		await game.loaded
		const texture = game.getTexture(sprite)
		inlineStyle = computeStyleFromTexture(texture)
	})()
})
</script>

<div
	class={`ssh-resource-image ${className}`}
	style={inlineStyle}
	title={alt}
	aria-label={alt}
></div>

<style>
	.ssh-resource-image {
		display: inline-block;
	}
</style>
