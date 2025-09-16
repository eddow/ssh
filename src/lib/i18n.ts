import {
	I18nClient,
	type Locale,
	type LocaleFlagsEngine,
	type TextKey,
	type Translator,
} from 'omni18n/ts/s-a'
import { writable } from 'svelte/store'

// PoI: Manage your locales here
export const locales = ['en', 'fr'] as const

export type TextInfos = {}
export type KeyInfos = {}

// Import translation dictionaries
import enTranslations from '../locales/en.json'
import frTranslations from '../locales/fr.json'

const translations = {
	en: enTranslations,
	fr: frTranslations,
}

class ClientSideClient extends I18nClient {
	report(key: TextKey, error: string, spec: object) {
		console.warn(`Translation error for key "${key}": ${error}`, spec)
	}
}

export const i18nClient = new ClientSideClient(['en'], condense)
export const T = writable<Translator>()
export const locale = writable<Locale>('en')
let queryLocale: string

locale.subscribe(async (locale) => {
	if (!locale) return
	queryLocale = locale
	await i18nClient.setLocales([locale])
	await initTranslator()
})

async function condense() {
	// Return the translations for the requested locale
	const translationData = translations[queryLocale as keyof typeof translations]
	if (!translationData) {
		console.warn(`No translations found for locale: ${queryLocale}`)
		return [translations.en]
	}

	return [translationData]
}

export async function initTranslator() {
	T.set(await i18nClient.enter())
}

export const localeFlags = writable<LocaleFlagsEngine>()

export function setLocale(newLocale: Locale) {
	locale.set(newLocale)
}
