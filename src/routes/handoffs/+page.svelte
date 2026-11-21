<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import HandoffPanel from '#lib/ui/HandoffPanel.svelte';
	import HandoffBrief from '#lib/ui/HandoffBrief.svelte';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	import PatientPath from '#lib/ui/PatientPath.svelte';
	import DeliveryHistory from '#lib/ui/DeliveryHistory.svelte';
	import '#lib/ui/flow.css';
	let { data, form }: PageProps = $props();
	const admin = $derived(data.account?.role === 'Administrative staff');
</script>
<svelte:head><title>{data.chart.patient.name} · {admin ? 'Transfer workspace' : 'Patient chart'}</title></svelte:head>
<header class="pagehead flow-title"><div><p class="kicker">{data.chart.patient.id} · {data.document.id} · {data.chart.patient.hospital}</p><h1>{data.chart.patient.name}</h1></div></header>
<div class="case-layout">
	<div class="case-column">
		{#key data.version}<HandoffPanel {data} message={form?.message} />{/key}
		{#if data.record}<div class="paper-card"><HandoffBrief record={data.record} documents={data.chart.documents} /></div>{/if}
	</div>
	<div class="case-column">
		{#key data.version}<PatientPath {data} />{/key}
		<HandoffDocument documents={data.chart.documents} />
		{#if data.record}<DeliveryHistory record={data.record}/>{/if}
	</div>
</div>
{#if data.record && admin}<details class="demo-setting"><summary>Demo controls</summary><p>Reset this synthetic transfer to replay the workflow.</p><form method="POST" action="?/reset" use:enhance><input type="hidden" name="version" value={data.version}/><button type="submit" class="button secondary">Reset handoff demo</button></form></details>{/if}
