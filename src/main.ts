import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import './lib/hmr-pixi' // Initialize HMR utilities for PixiJS
import { initTranslator } from './lib/i18n'

// Wait for translations to load before mounting the app
async function initApp() {
	await initTranslator()
	
	const app = mount(App, {
		target: document.getElementById('app')!,
	})
}

initApp().catch(console.error)
