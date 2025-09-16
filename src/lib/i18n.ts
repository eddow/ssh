import {
	type CondensedDictionary,
	I18nClient,
	type Locale,
	type LocaleFlagsEngine,
	type TextKey,
	type Translator,
} from 'omni18n/ts/s-a'
import { writable } from 'svelte/store'
export const locales = ['en', 'fr'] as const

export type TextInfos = {}
export type KeyInfos = {}

class ClientSideClient extends I18nClient {
	report(key: TextKey, error: string, spec: object) {
		console.warn(`Translation error for key "${key}": ${error}`, spec)
	}
}

export const i18nClient = new ClientSideClient(['en'], condense)
export const T = writable<Translator>()
// Get saved locale from localStorage or default to 'en'
const savedLocale = localStorage.getItem('locale') as Locale | null
export const locale = writable<Locale>(savedLocale || 'en')
let queryLocale: string

locale.subscribe(async (locale) => {
	if (!locale) return
	queryLocale = locale
	await i18nClient.setLocales([locale])
	await initTranslator()
})
const zonePaths = {
	'': '..',
	gameX: '../../assets',
}
async function condense(lng: string[], zones: string[]) {
	// Return the translations for the requested locale
	return Promise.all(
		zones.map(
			(zone) => import(`${zonePaths[zone as keyof typeof zonePaths]}/locales/${queryLocale}.json`),
		),
	).then((cds) => cds.map((cd) => cd.default) as CondensedDictionary[])
}

export async function initTranslator() {
	T.set(await i18nClient.enter('gameX'))
}

export const localeFlags = writable<LocaleFlagsEngine>()

export function setLocale(newLocale: Locale) {
	locale.set(newLocale)
	localStorage.setItem('locale', newLocale)
}
