<script lang="ts">
	import { resolve } from '$app/paths';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const chartQuery = (id: string) => new URLSearchParams({ patient: id, ...(data.query && { q: data.query }) }).toString();
</script>

<svelte:head><title>Patient records · Intake Desk</title></svelte:head>
<div class="pagehead">
	<div><p class="kicker">Mossbridge Community Hospital</p><h1>Patient records</h1><p class="lead">Find a visit and read the original paperwork.</p></div>
</div>
<div class="record-layout">
	<aside class="paper-card directory" aria-label="Patient directory">
		<form method="GET" action={resolve('/patients')} role="search">
			<label for="chart-search">Find a patient</label>
			<input id="chart-search" type="search" name="q" value={data.query} placeholder="Name, chart ID or visit ID" />
			<div class="search-actions"><button class="button secondary">Search</button>{#if data.query}<a href={resolve('/patients')}>Clear search</a>{/if}</div>
		</form>
		{#if data.matches.length}
			<nav aria-label="Patients">{#each data.matches as patient (patient.id)}
				<a href={resolve(`/patients?${chartQuery(patient.id)}`)} aria-current={patient.id === data.patient?.id ? 'page' : undefined}>
					<strong>{patient.name}</strong><small>Chart {patient.id}</small>
				</a>
			{/each}</nav>
		{:else}<p class="no-results">No patient matches “{data.query}”.</p>{/if}
	</aside>
	{#if data.patient}
		<section aria-labelledby="record-name">
			<div class="record-head">
				<div><p class="kicker">Chart {data.patient.id}</p><h2 id="record-name">{data.patient.name}</h2></div>
				{#if data.hasTransfer}<a class="button" href={resolve('/handoffs')}>Open transfer workspace</a>{:else}<span class="tag">Completed visits</span>{/if}
			</div>
			{#key data.patient.id}<HandoffDocument documents={data.documents} hasBrief={false} />{/key}
		</section>
	{/if}
</div>

<style>
	.record-layout {display:grid;grid-template-columns:minmax(220px, .75fr) minmax(0, 2fr);gap:clamp(16px,3vw,36px);align-items:start}
	.directory {overflow:hidden}
	.directory form {padding:20px;border-bottom:1px solid var(--line)}
	label {display:block;margin-bottom:8px;font-weight:650}
	input {width:100%;border:1px solid #a6b5a4;border-radius:6px;background:white;color:var(--ink);font:inherit;font-size:15px;padding:10px}
	.search-actions,.record-head {display:flex;align-items:center;gap:12px;flex-wrap:wrap}
	.search-actions {margin-top:10px;font-size:14px}
	.directory nav {padding:6px}
	.directory nav a {display:block;padding:14px;text-decoration:none;border-left:3px solid transparent;border-radius:4px}
	.directory nav a[aria-current] {border-left-color:var(--forest);background:#e7efdf}
	.directory nav a:hover {background:#f0f4ea}
	.directory small {display:block;color:var(--muted)}
	.record-head {justify-content:space-between;margin-bottom:16px}
	.record-head h2 {font-size:30px}
	.no-results {padding:18px}
	@media(max-width:720px){.record-layout{grid-template-columns:minmax(0,1fr)}}
</style>
