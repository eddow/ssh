<script lang="ts" module>
	export function title(params: Record<string, any>) {
		return `Tile ${params.tile.q},${params.tile.r}`
	}
</script>

<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { EyeOutline } from 'flowbite-svelte-icons'

	//let tile = $derived(land.tile(hKey))
	const terrainTypeName = 'tile'
	function goTo() {}
</script>

<div class="tile-info">
	<h1>{terrainTypeName}</h1>
	<Button onclick={goTo}>
		<EyeOutline class="w-6 h-6" />
	</Button>
</div>
