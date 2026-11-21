<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import type { PatientEvent } from '../clinical-activity';
	import ChartCitation from './ChartCitation.svelte';

	type Brief = { mode: 'local' | 'codex'; visitId: string; items: PatientEvent[] };
	type BriefResult = { patientId?: string; chartBrief?: Brief; briefError?: string };
	let { patientId, result }: { patientId: string; result?: BriefResult | null } = $props();
	let pending = $state(false);
	let networkError = $state('');
	const response = $derived(result?.patientId === patientId ? result : null);
	const brief = $derived(response?.chartBrief);
	const action = $derived.by(() => {
		const filters = [...page.url.searchParams].filter(([key]) => key === 'q' || key === 'scope');
		return '?/prepareBrief&' + new URLSearchParams([['patient', patientId], ...filters]).toString();
	});
	const submit: SubmitFunction = ({ cancel, formElement }) => {
		if (pending) { cancel(); return; }
		pending = true;
		networkError = '';
		return async ({ result, update }) => {
			try {
				if (!formElement.isConnected) return;
				if (result.type === 'error') networkError = 'The briefing could not load. Please try again.';
				else await update({ reset: false });
			} finally { pending = false; }
		};
	};
</script>

<section class="paper-card chart-brief" aria-label="Visit briefing">
	<div class="brief-heading">
		<div>
			<h2>Visit briefing</h2>
			<p>{brief ? brief.visitId + ' · ' + (brief.mode === 'codex' ? 'Passages selected by Codex' : 'Local extraction') : 'Read the documented findings from the latest visit.'}</p>
		</div>
		<form method="POST" {action} use:enhance={submit}>
			<button class="button" type="submit" name="mode" value="local" disabled={pending}>{brief ? 'Refresh local brief' : 'Prepare chart brief'}</button>
			<details><summary>Briefing options</summary>
				<button class="text-button" type="submit" name="mode" value="codex" disabled={pending}>Select passages with Codex</button>
			</details>
		</form>
	</div>
	{#if pending}<p class="feedback" role="status">Preparing the visit briefing…</p>{/if}
	{#if networkError || response?.briefError}<p class="notice error" role="alert">{networkError || response?.briefError}</p>{/if}
	{#if brief}
		<p class="sr" role="status">Briefing ready. {brief.items.length} source passages.</p>
		{#if brief.items.length}
			<ul>{#each brief.items as item (item.id)}
				<li><h3>{item.title}</h3><p>{item.text}</p>
					{#if item.documentId && item.line}
						<ChartCitation doc={item.documentId} line={item.line} label={'View original passage in ' + item.source} />
					{/if}
				</li>
			{/each}</ul>
		{:else}<p class="feedback">No source passages were available for this visit.</p>{/if}
	{/if}
</section>

<style>
	.chart-brief {padding:18px 22px; overflow-wrap:anywhere}
	.brief-heading {display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px 20px}
	.brief-heading p,.feedback {margin-top:6px; color:var(--muted); font-size:14px}
	form {display:flex; flex-wrap:wrap; align-items:center; gap:8px 15px}
	summary {color:var(--ink); cursor:pointer; font-size:13px}
	ul {list-style:none; margin:14px 0 0; padding:0}
	li {padding:11px 0; border-top:1px solid var(--line)}
	li:last-child {padding-bottom:0}
	li h3 {font-size:16px}
	li p {margin:4px 0; line-height:1.45}
</style>
