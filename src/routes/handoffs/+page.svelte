<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { PageProps } from './$types';
	import HandoffPanel from '#lib/ui/HandoffPanel.svelte';
	import HandoffBrief from '#lib/ui/HandoffBrief.svelte';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	import PatientPath from '#lib/ui/PatientPath.svelte';
	import DeliveryHistory from '#lib/ui/DeliveryHistory.svelte';
	import '#lib/ui/flow.css';
	let { data, form }: PageProps = $props();
	const admin = $derived(data.account?.role === 'Administrative staff');
	let resetting = $state(false);
	const startPractice: SubmitFunction = ({ cancel }) => {
		if (resetting) { cancel(); return; }
		resetting = true;
		return async ({ update }) => {
			try { await update(); } finally { resetting = false; }
		};
	};
</script>
<svelte:head><title>{data.chart.patient.name} · {admin ? 'Transfer workspace' : 'Patient chart'}</title></svelte:head>
<header class="pagehead flow-title">
	<div><p class="kicker">{data.chart.patient.id} · {data.document.id} · {data.chart.patient.hospital}</p><h1>{data.chart.patient.name}</h1>
		<a class="chart-link" href={resolve(`/patients?patient=${data.chart.patient.id}`)}>View patient chart</a></div>
</header>
<div class="case-layout">
	<div class="case-column">
		{#key data.version}<HandoffPanel {data} message={form?.message} />{/key}
		{#if data.record}<div class="paper-card"><HandoffBrief items={data.packetPoints} record={data.record} documents={data.chart.documents} /></div>{/if}
	</div>
	<div class="case-column">
		{#key data.version}<PatientPath {data} />{/key}
		<HandoffDocument overviews={data.overviews} documents={data.chart.documents} />
		{#if data.record}<DeliveryHistory record={data.record}/>{/if}
	</div>
</div>
{#if admin}
	<details class="demo-setting">
		<summary>Demo controls</summary>
		<p role="status">{data.practiceAccession ? 'Practice sample · Prior study ' + data.practiceAccession : 'Original sample · Jordan’s transfer'}</p>
		<p>Restart Jordan’s handoff for all demo accounts.</p>
		<div class="rehearsal-actions">
			{#if data.record || data.practiceAccession || data.imagingNotice.receivedVia === 'matched-delivery'}
				<form method="POST" action="?/reset" use:enhance>
					<input type="hidden" name="version" value={data.version}/>
					<button type="submit" class="button secondary">Reset handoff demo</button>
				</form>
			{/if}
			<form method="POST" action="?/randomize" use:enhance={startPractice} aria-busy={resetting}>
				<input type="hidden" name="version" value={data.version}/>
				<button class="button secondary" type="submit" disabled={resetting}>{resetting ? 'Starting sample…' : 'Reset and randomize sample'}</button>
			</form>
			<a href={resolve('/glossary?watch=1#walkthrough')}>Presenter guide and video</a>
		</div>
	</details>
{/if}

<style>
	.rehearsal-actions { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
</style>
