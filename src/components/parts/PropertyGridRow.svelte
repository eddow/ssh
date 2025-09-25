<script lang="ts">
let {
	label,
	class: className = '',
	children,
}: { label: string; class?: string; children: any } = $props()
</script>

<tr class="property-grid-row">
	<td class="property-label">
		<span class="font-medium text-gray-700 dark:text-gray-300">{label}</span>
	</td>
	<td class="property-value {className}">
		{@render children()}
	</td>
</tr>

<style>
	.property-grid-row {
		border-bottom: 1px solid rgb(229 231 235); /* gray-200 */
	}

	:global(.dark) .property-grid-row {
		border-bottom-color: rgb(55 65 81); /* gray-700 */
	}

	.property-label {
		padding: 0.5rem 0.75rem;
		vertical-align: top;
		width: 40%;
		min-width: 120px;
	}

	.property-value {
		padding: 0.5rem 0.75rem;
		vertical-align: top;
		width: 60%;
	}

	/* Remove border from last row */
	.property-grid-row:last-child {
		border-bottom: none;
	}
</style>
