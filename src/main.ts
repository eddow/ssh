import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import './lib/hmr-pixi' // Initialize HMR utilities for PixiJS

const app = mount(App, {
	target: document.getElementById('app')!,
})

export default app
