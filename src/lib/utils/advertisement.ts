import { goods as goodsCatalog } from '$assets/game-content'
import { assert } from '$lib/debug'
import type { GoodType } from '$lib/types'

export type ExchangePriority = '0-store' | '1-buffer' | '2-use'
export type Advertisement = 'demand' | 'provide'
export type PerGood<T> = Partial<Record<GoodType, T>>
export type GoodsRelations = PerGood<{ advertisement: Advertisement; priority: ExchangePriority }>

const assertGoodType = (goodType: string): goodType is GoodType => {
	return goodType in goodsCatalog
}

interface StorageBase {
	canTake(goodType: GoodType, priority: ExchangePriority): boolean
	canGive(goodType: GoodType, priority: ExchangePriority): boolean
}

export abstract class AdvertisementManager<Advertiser> {
	advertisements: PerGood<{
		advertisement: Advertisement
		priority: ExchangePriority
		advertisers: Advertiser[]
	}> = {}
	private lastAds = new Map<Advertiser, GoodsRelations>()
	abstract readonly generalStorages: (StorageBase & Advertiser)[]
	abstract createMovement(goodType: GoodType, giver: Advertiser, taker: Advertiser): void
	abstract selectMovement(
		advertisement: Advertisement,
		giver: Advertiser,
		storages: Advertiser[],
		goodType: GoodType,
	): Advertiser
	advertise(advertiser: Advertiser, ads: GoodsRelations) {
		if (this.lastAds.has(advertiser)) {
			const lastAds = this.lastAds.get(advertiser)!
			for (const goodType in lastAds) {
				if (!assertGoodType(goodType)) continue
				const thisAd = this.advertisements[goodType]
				if (
					thisAd &&
					lastAds[goodType]!.advertisement === thisAd.advertisement &&
					lastAds[goodType]!.priority === thisAd.priority
				) {
					thisAd.advertisers = thisAd.advertisers.filter((a) => a !== advertiser)
					if (thisAd.advertisers.length === 0) delete this.advertisements[goodType]
				}
			}
		}
		this.lastAds.set(advertiser, ads)
		for (const [goodType, ad] of Object.entries(ads)) {
			if (!assertGoodType(goodType)) continue
			const thisAd = this.advertisements[goodType]

			if (thisAd && thisAd.advertisement !== ad.advertisement) {
				const selected = this.selectMovement(
					ad.advertisement,
					advertiser,
					thisAd.advertisers,
					goodType,
				)
				thisAd.advertisers = thisAd.advertisers.filter((a) => a !== selected)
				if (thisAd.advertisers.length === 0) delete this.advertisements[goodType]
			} else {
				// In specific case when we have something produced and don't know where to put it, try to find a general storage
				const availableGeneralStorages = this.generalStorages.filter(
					ad.advertisement === 'provide'
						? (s) => s.canTake(goodType, ad.priority)
						: (s) => s.canGive(goodType, ad.priority),
				)
				if (availableGeneralStorages.length > 0) {
					this.selectMovement(ad.advertisement, advertiser, availableGeneralStorages, goodType)
				} else if (thisAd) {
					assert(thisAd.advertisement === ad.advertisement, 'Advertisement type mismatch')
					assert(thisAd.priority === ad.priority, 'Priority mismatch')
					thisAd.advertisers.push(advertiser)
				} else {
					this.advertisements[goodType] = {
						advertisers: [advertiser],
						...ad,
					}
				}
			}
		}
	}
}
