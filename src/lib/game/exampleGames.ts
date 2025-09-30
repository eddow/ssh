import type { GamePatches } from './game'

export const chopSaw = {
	hives: [
		{
			name: 'ChopSaw',
			alveoli: [
				{ alveolus: 'tree_chopper', coord: { q: 0, r: 0 } },
				{ alveolus: 'sawmill', coord: { q: 1, r: 0 } },
				{ alveolus: 'storage', coord: { q: 0, r: 1 } },
			],
		},
	],
} satisfies GamePatches
