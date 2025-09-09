import { resolve } from "node:path"
import { babel } from "@rollup/plugin-babel"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"
import phaser from "vite-plugin-phaser"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
	plugins: [
		tailwindcss(),
		svelte(),
		phaser,
		babel({
			babelHelpers: "bundled",
			extensions: [".ts", ".js"],
			plugins: [
				["@babel/plugin-proposal-decorators", { version: "2023-05" }], // Modern decorators
				["@babel/plugin-transform-typescript", { isTS: true }],
			],
		}),
	],
	resolve: {
		alias: {
			$lib: resolve("./src/lib"),
			$components: resolve("./src/components"),
			$assets: resolve("./assets"),
		},
	},
})
