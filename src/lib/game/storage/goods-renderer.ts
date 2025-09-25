import { effect } from 'mutts'
import { ColorMatrixFilter, Container, Graphics, Sprite } from 'pixi.js'
import { goods as goodsCatalog } from '$assets/game-content'
import type { GoodType } from '$lib/arktype'

export interface GoodSlot {
	goodType: GoodType
	present: number
	reserved: number
	allocated: number
	allowed: number
}

/**
 * Renders goods based on the provided slots, similar to slotted storage but with one slot per good type.
 * Each good type gets its own "slot" and can show different visual states.
 */
export function renderGoods(
	game: any,
	size: number,
	slots: () => GoodSlot[],
	assumedMaxSlots?: number,
): Container {
	const root = new Container()
	effect(() => {
		const sprites: (Sprite | Graphics)[] = []
		const activeSlots = slots().filter(
			(slot) => slot.present > 0 || slot.reserved > 0 || slot.allocated > 0,
		)

		if (activeSlots.length === 0) {
			return
		}

		const n = assumedMaxSlots ?? activeSlots.length
		const [centerIndex, around] = n === 1 || n === 5 ? [0, n - 1] : [-1, n]

		// Calculate layout
		const radius = size * 0.4
		const spriteSize = size * 0.5

		for (let i = 0; i < activeSlots.length; i++) {
			const slot = activeSlots[i]
			const goodDef = goodsCatalog[slot.goodType]
			if (!goodDef) continue

			// Calculate position for this slot
			let [x, y] = [0, 0]
			if (centerIndex !== i) {
				const angle = (i * 2 * Math.PI) / around
				x = Math.cos(angle) * radius
				y = Math.sin(angle) * radius
			}
			const texture = game.getTexture(goodDef.sprites[0])
			const scale = spriteSize / texture.height
			const dy = spriteSize / 4
			const totalHeight = (slot.allowed + 1) * dy
			const presentOffset = dy - totalHeight / 2
			// Draw blueish gauge indicating max height (-H/2 to +H/2)
			const gaugeWidth = spriteSize * 0.6
			const gauge = new Graphics()
			gauge
				.rect(x - gaugeWidth / 2, y - totalHeight / 2, gaugeWidth, totalHeight)
				.fill({ color: 0x000080, alpha: 0.5 })
			root.addChild(gauge)
			sprites.push(gauge)

			// Render present goods (normal colors) - one sprite per quantity
			for (let q = 0; q < slot.present; q++) {
				const sprite = new Sprite(texture)
				sprite.scale.set(scale)
				sprite.anchor.set(0.5)
				sprite.position.set(x, y - q * dy - presentOffset)
				root.addChild(sprite)
				sprites.push(sprite)
			}
			const reservedOffset = presentOffset + slot.present * dy
			// Render reserved goods (reddish tint) - one sprite per reserved quantity
			for (let r = 0; r < slot.reserved; r++) {
				const sprite = new Sprite(texture)
				sprite.scale.set(scale)
				sprite.anchor.set(0.5)
				// Apply reddish tint
				sprite.tint = 0xff6666 // Light red tint
				sprite.position.set(x, y - r * dy - reservedOffset)
				root.addChild(sprite)
				sprites.push(sprite)
			}

			const allocatedOffset = reservedOffset + slot.reserved * dy
			// Render allocated goods (black & white) - one sprite per allocated quantity
			for (let a = 0; a < slot.allocated; a++) {
				const sprite = new Sprite(texture)
				sprite.scale.set(scale)
				sprite.anchor.set(0.5)
				// Apply grayscale filter (black & white)
				const grayscaleFilter = new ColorMatrixFilter()
				grayscaleFilter.desaturate()
				sprite.filters = [grayscaleFilter]
				sprite.position.set(x, y - a * dy - allocatedOffset)
				root.addChild(sprite)
				sprites.push(sprite)
			}
		}

		return () => {
			for (const s of sprites) s.destroy()
		}
	})
	return root
}
