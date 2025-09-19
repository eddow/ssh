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
const imports = {
	'': {
		en: () => import('../locales/en.json'),
		fr: () => import('../locales/fr.json'),
	},
	gameX: {
		en: () => import('$assets/locales/en.json'),
		fr: () => import('$assets/locales/fr.json'),
	},
}
async function condense(_lng: string[], zones: string[]) {
	// Return the translations for the requested locale
	return Promise.all(
		zones.map((zone) => imports[zone as keyof typeof imports][queryLocale as 'en' | 'fr']()),
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
