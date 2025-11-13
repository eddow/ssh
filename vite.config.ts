import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from '@babel/core'
import { babelPluginJsxReactive } from 'pounce-ts/plugin'
import { defineConfig, type Plugin } from 'vite'

const projectRootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	plugins: [
		{
			name: 'babel-jsx-transform',
			enforce: 'pre',
			async transform(code, id) {
				if (!/\.(tsx?|jsx?)$/.test(id)) return null

				const isTsx = id.endsWith('.tsx')

				const result = transformSync(code, {
					filename: id,
					babelrc: false,
					configFile: false,
					plugins: [
						babelPluginJsxReactive,
						['@babel/plugin-proposal-decorators', { version: '2023-05' }],
						[
							'@babel/plugin-transform-react-jsx',
							{
								runtime: 'automatic',
								importSource: 'pounce-ts/runtime',
								throwIfNamespace: false,
							},
						],
						[
							'@babel/plugin-transform-typescript',
							{
								isTSX: isTsx,
								allowDeclareFields: true,
								disallowAmbiguousJSXLike: isTsx,
							},
						],
					],
					sourceMaps: true,
				})

				if (!result) return null
				return { code: result.code || '', map: result.map as any }
			},
		} as Plugin,
	],
	resolve: {
		alias: {
			$lib: resolvePath(projectRootDir, 'src/lib'),
			$components: resolvePath(projectRootDir, 'src/components'),
			$assets: resolvePath(projectRootDir, 'assets'),
			'@app': resolvePath(projectRootDir, 'src'),
			'@pounce': resolvePath(projectRootDir, 'node_modules/pounce-ts/src'),
		},
	},
	esbuild: false,
})
