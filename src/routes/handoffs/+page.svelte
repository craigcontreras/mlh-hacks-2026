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
	{#if admin}
		<form class="practice-control" method="POST" action="?/randomize" use:enhance={startPractice} aria-busy={resetting}>
			<input type="hidden" name="version" value={data.version}/>
			<button class="button secondary" type="submit" disabled={resetting} aria-describedby="reset-scope">{resetting ? 'Starting sample…' : 'Reset and randomize sample'}</button>
			<small id="reset-scope">Restarts Jordan’s handoff for all demo accounts.</small>
		</form>
	{/if}
</header>
{#if admin}
	<section class="practice" aria-label="Demo practice">
		<p role="status">{data.practiceAccession ? 'Practice sample · Prior study ' + data.practiceAccession : 'Original sample · Jordan’s transfer'}</p>
		<details>
			<summary>Presenter notes</summary>
			<p>Show the judges where today’s report came from and who will check the older images.</p>
			<ol>
				<li><strong>Maya, administrator.</strong> Prepare the brief. Expand <b>Compare current and prior records</b>, open a source, then sign and send to nursing.</li>
				<li><strong>Riley, nurse.</strong> Open Jordan in <b>My inbox</b>.
					{data.practiceAccession ? 'Read the Imaging Records reply and record what it says.' : 'Choose Still pending to rehearse a missing-image follow-up.'}
					Send the report to the named doctor.</li>
				<li><strong>Receiving doctor.</strong> Open the signed radiology impression and sign the review. To practice reassignment, Avery can return it with a reason, and Maya can send it to Morgan.</li>
			</ol>
			<p>After sign-off, show the patient log. If the older images still need checking, Riley has a follow-up. If they have arrived, the review is complete.</p>
		</details>
	</section>
{/if}
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
{#if (data.record || data.practiceAccession) && admin}<details class="demo-setting"><summary>Demo controls</summary><p>Restore Jordan’s original packet and restart the handoff.</p><form method="POST" action="?/reset" use:enhance><input type="hidden" name="version" value={data.version}/><button type="submit" class="button secondary">Reset handoff demo</button></form></details>{/if}

<style>
	.practice-control { display: grid; justify-items: start; gap: 4px; }
	.practice-control small, .practice > p { color: var(--muted); font-size: 13px; }
	.practice { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 18px; margin: 0 0 18px; }
	.practice details[open] { flex-basis: 100%; max-width: 68ch; }
	.practice summary { width: fit-content; cursor: pointer; font-size: 14px; font-weight: 600; }
	.practice details p, .practice ol { margin: 8px 0; }
	.practice ol { padding-left: 1.5rem; }
	.practice li + li { margin-top: 6px; }
</style>
