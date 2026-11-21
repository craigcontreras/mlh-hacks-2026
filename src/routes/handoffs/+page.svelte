<script lang="ts">
	import type { PageProps } from './$types';
	import HandoffPanel from '#lib/ui/HandoffPanel.svelte';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	let { data, form }: PageProps = $props();
	const admin = $derived(data.account?.role === 'Administrative staff');
</script>
<svelte:head><title>{admin ? 'Transfer workspace' : 'Patient chart'} · Intake Desk</title></svelte:head>
<header class="pagehead"><div><p class="kicker">{data.chart.patient.hospital} · Synthetic record</p><h1>{admin ? 'Transfer workspace' : 'Patient chart'}</h1><p class="lead">{admin ? 'Review pending records and route the next task for this transfer.' : 'Review the current transfer alongside earlier visit documents.'}</p></div></header>
<div class="handoff-grid">
	{#key data.version}<HandoffPanel {data} message={form?.message} />{/key}
	<HandoffDocument documents={data.chart.documents} hasBrief={Boolean(data.record)} />
</div>
