import { vi } from 'vitest'

// Mock fetch to prevent asset loading errors
global.fetch = vi.fn(() =>
	Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve({}),
		text: () => Promise.resolve(''),
		blob: () => Promise.resolve(new Blob()),
	} as Response),
) as any

// Mock localStorage
const mockLocalStorage = {
	getItem: vi.fn(() => null),
	setItem: vi.fn(() => null),
	removeItem: vi.fn(() => null),
	clear: vi.fn(() => null),
}

// Mock document
const mockDocument = {
	baseURI: 'http://localhost:3000/',
	createElement: vi.fn(() => ({
		href: '',
		protocol: 'http:',
		hostname: 'localhost',
		port: '3000',
		pathname: '/',
		search: '',
		hash: '',
	})),
}

// Mock Image constructor
;(globalThis as any).Image = class {
	src = ''
	onload: (() => void) | null = null
	onerror: (() => void) | null = null
	constructor() {
		// Mock implementation
	}
} as any

// Mock global objects
;(globalThis as any).localStorage = mockLocalStorage
;(globalThis as any).document = mockDocument

// Mock window if it doesn't exist
if (typeof (globalThis as any).window === 'undefined') {
	;(globalThis as any).window = {
		localStorage: mockLocalStorage,
		document: mockDocument,
		Image: (globalThis as any).Image,
	} as any
}

// Mock PIXI.js Assets to prevent asset loading during tests
vi.mock('pixi.js', async () => {
	const actual = await vi.importActual('pixi.js')
	return {
		...actual,
		Assets: {
			load: vi.fn(() =>
				Promise.resolve({
					defaultAnchor: { x: 0.5, y: 0.5 },
					width: 32,
					height: 32,
				}),
			),
			add: vi.fn(),
			init: vi.fn(() => Promise.resolve()),
		},
	}
})

// Define globals for vitest
declare global {
	const describe: typeof import('vitest').describe
	const it: typeof import('vitest').it
	const expect: typeof import('vitest').expect
	const beforeEach: typeof import('vitest').beforeEach
	const afterEach: typeof import('vitest').afterEach
	const beforeAll: typeof import('vitest').beforeAll
	const afterAll: typeof import('vitest').afterAll
}
