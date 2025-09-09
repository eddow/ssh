/**
 * HMR utilities for PixiJS applications
 * Handles proper cleanup and reloading of PixiJS infrastructure during development
 */

import type { Application } from 'pixi.js'

// Global registry of active PixiJS applications for HMR cleanup
const activePixiApps = new Set<Application>()

export function registerPixiApp(app: Application) {
	activePixiApps.add(app)
}

export function unregisterPixiApp(app: Application) {
	activePixiApps.delete(app)
}

export function destroyAllPixiApps() {
	for (const app of activePixiApps) {
		try {
			// Remove canvas from DOM if it exists
			if (app.canvas && app.canvas.parentNode) {
				app.canvas.parentNode.removeChild(app.canvas)
			}
			
			// Destroy the application
			app.destroy(true, { children: true, texture: true })
		} catch (error) {
			console.warn('Error destroying PixiJS app during HMR:', error)
		}
	}
	activePixiApps.clear()
}

// Set up global HMR handling for PixiJS
if (import.meta.hot) {
	import.meta.hot.accept(() => {
		console.log('🔥 HMR: Reloading PixiJS infrastructure...')
		
		// Destroy all active PixiJS applications on HMR
		destroyAllPixiApps()
		
		// Clear any global PixiJS references
		//@ts-expect-error
		if (globalThis.__PIXI_APP__) {
			//@ts-expect-error
			globalThis.__PIXI_APP__ = null
		}
		
		// Force garbage collection if available (development only)
		if (typeof window !== 'undefined' && (window as any).gc) {
			(window as any).gc()
		}
		
		console.log('✅ HMR: PixiJS infrastructure reloaded')
	})
	
	// Handle HMR dispose
	import.meta.hot.dispose(() => {
		console.log('🧹 HMR: Disposing PixiJS resources...')
		destroyAllPixiApps()
	})
}
