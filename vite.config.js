import { resolve } from "node:path"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"
import phaser from "vite-plugin-phaser"

export default defineConfig({
	plugins: [svelte(), phaser],
	resolve: {
		alias: {
			$lib: resolve("./src/lib"),
		},
	},
})
