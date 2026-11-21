<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import Receipt from '#lib/ui/Receipt.svelte';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>Registration desk · Intake Desk</title></svelte:head>
<div class="pagehead">
	<div><p class="kicker">Receiving workspace</p><h1>Registration desk</h1><p class="lead">Read the transfer details signed off by intake.</p></div>
	<span class="count">{data.receipts.length} approved {data.receipts.length === 1 ? 'handoff' : 'handoffs'}</span>
</div>
{#if data.receipts.length}
	<div class="receipts">
		{#each data.receipts as receipt (receipt.packetId)}<Receipt {receipt} />{/each}
	</div>
{:else}
	<section class="empty paper-card">
		<span class="tray-mark" aria-hidden="true"></span>
		<h2>Waiting for the first handoff</h2>
		<p>When an intake clerk approves a packet, its reviewed fields and signature appear here.</p>
		<a href={resolve('/')} class="button secondary">Open intake workspace</a>
	</section>
{/if}
