import {
	I18nClient,
	type Locale,
	type Translator,
	type LocaleFlagsEngine,
	type TextKey
} from 'omni18n/ts/s-a'
import { writable } from 'svelte/store'

// PoI: Manage your locales here
export const locales = ['en', 'fr'] as const

export interface TextInfos {}
export interface KeyInfos {}

// Import translation dictionaries
import enTranslations from '../locales/en.json'
import frTranslations from '../locales/fr.json'

const translations = {
	en: enTranslations,
	fr: frTranslations
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

// Helper function for module scripts
export function getTranslation(key: string, params?: Record<string, string>): string {
	// This is a fallback for module scripts - in practice, the T store should be used
	const keys = key.split('.')
	// For now, return the key as fallback - this should be improved with a proper lookup
	if (params) {
		return Object.entries(params).reduce(
			(str, [paramKey, paramValue]) => str.replace(`{${paramKey}}`, paramValue),
			key
		)
	}
	return key
}

export function setLocale(newLocale: Locale) {
	locale.set(newLocale)
}