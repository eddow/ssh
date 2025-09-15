<script lang="ts" module>
	import { getTranslation } from '$lib/i18n'

	export function title(params: Record<string, any>) {
		return getTranslation('ui.configuration')
	}
</script>

<script lang="ts">
	//https://uxwing.com/?s=Mouse+left+
	//https://boxy-svg.com/

	import { Alert } from 'flowbite-svelte'
	import DarkMode from '$components/dark-mode.svelte'
	import { configuration } from '$lib/globals.svelte'
	import { T } from '$lib/i18n'

	let darkMode = $state(configuration.darkMode)

	$effect(() => {
		configuration.darkMode = darkMode
	})

	$effect(() => {
		localStorage.setItem('configuration', JSON.stringify(configuration))
	})
</script>

<DarkMode bind:darkMode />
<Alert>
	<p>{$T.ui.wheelZoomLookAt}</p>
	<p>{$T.ui.bothButtonsPan}</p>
</Alert>
