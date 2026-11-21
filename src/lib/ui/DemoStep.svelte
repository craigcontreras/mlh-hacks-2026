<script lang="ts">
	import { page } from '$app/state';
	import type { AccountId } from '../server/accounts';
	let { n, owner }: { n: number; owner: AccountId } = $props();
</script>

{#if page.data.guide?.owner?.id === owner}
	<span class="sr">Step {n}. </span>
	<span class="demo-step" data-demo-step={n} aria-hidden="true">{n}</span>
{/if}

<style>
	.demo-step {
		display: inline-grid; place-items: center; min-width: 1.45rem; height: 1.45rem;
		padding-inline: 3px; margin-inline-end: .4rem; vertical-align: middle; flex: none;
		border-radius: 50%; border: 1px solid #93bcb5; background: #d8f6ec; color: #143f35;
		font: 700 .75rem/1 ui-monospace, monospace; font-variant-numeric: tabular-nums;
	}
</style>
