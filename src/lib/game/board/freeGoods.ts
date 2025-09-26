import { effect, reactive, type ScopedCallback } from 'mutts'
import { Container, Sprite } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { AxialKeyMap } from '$lib/mem'
import { epsilon } from '$lib/utils'
import { GameObject, withGenerator } from '../object'
import {
	axialDistance,
	type Position,
	type Positioned,
	toAxialCoord,
	toWorldCoord,
} from '../position'

export interface FreeGood {
	goodType: GoodType
	position: Position
	remove(): void
}

export class FreeGoods extends withGenerator(GameObject) {
	private readonly goods = new AxialKeyMap<FreeGood[]>()
	private readonly display = new Map<FreeGood, { sprite: Sprite; cleanup: ScopedCallback }>()
	private readonly fgContainer: Container = new Container()
	render() {
		this.game.effectLayer.addChild(this.fgContainer)
		return () => {
			this.game.effectLayer.removeChild(this.fgContainer)
		}
	}
	add(pos: Positioned, goodType: GoodType, exactly?: Position) {
		assert(
			exactly === undefined || axialDistance(exactly, pos) < 0.5 + epsilon,
			'`exactly` must be roughly the same as pos.position',
		)
		const coord = toAxialCoord(pos)
		const good: FreeGood = reactive({
			goodType,
			position: exactly || ('position' in pos ? pos.position : pos),
			remove: () => this.remove(pos, good),
		})
		this.goods.set(coord, [...(this.goods.get(coord) || []), good])
		const sprite = new Sprite(this.game.getTexture(good.goodType))

		this.fgContainer.addChild(sprite)
		this.game.hex.resizeSprite(sprite, 0.8)
		this.display.set(good, {
			sprite,
			cleanup: effect(() => {
				const { x, y } = toWorldCoord(good.position)
				sprite.position.set(x, y)
			}),
		})
		return good
	}
	remove(pos: Positioned, good: FreeGood): void {
		const coord = toAxialCoord(pos)
		const newList = this.goods.get(coord)!.filter((g) => g !== good)
		if (newList.length === 0) this.goods.delete(coord)
		else this.goods.set(coord, newList)
		const display = this.display.get(good)
		if (display) {
			display.cleanup()
			display.sprite.destroy()
			this.display.delete(good)
		}
	}
}
