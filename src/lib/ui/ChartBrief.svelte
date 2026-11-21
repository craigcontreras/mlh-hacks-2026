<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import type { ChartBrief } from '../server/chart-brief';
	import ChartFindings from './ChartFindings.svelte';

	type BriefResult = { patientId?: string; chartBrief?: ChartBrief; briefError?: string };
	let { patientId, initial, result, rankingProvider }: {
		patientId: string; initial: ChartBrief; result?: BriefResult | null; rankingProvider: 'codex' | 'gemini'
	} = $props();
	const providerNames = { codex: 'Codex', gemini: 'Gemini' };
	let pending = $state(false);
	let networkError = $state('');
	const response = $derived(result?.patientId === patientId ? result : null);
	const brief = $derived.by(() => {
		const ordered = response?.chartBrief;
		if (ordered?.visitId !== initial.visitId || ordered.items.length !== initial.items.length) return initial;
		const current = new Map(initial.items.map(item => [item.id, item]));
		const items = ordered.items.flatMap(item => current.get(item.id) ?? []);
		return items.length === initial.items.length ? { ...initial, items, mode: ordered.mode } : initial;
	});
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

<section class="paper-card chart-brief" aria-labelledby="chart-brief-title">
	<header><h2 id="chart-brief-title">Chart summary</h2>
		<p>{brief.items.length} findings from the patient’s records. Select a source to read the original passage.</p>
	</header>
	<ChartFindings items={brief.items} {patientId} />
	{#if brief.items.length > 1}
		<details class="options"><summary>Summary options</summary>
			<form method="POST" {action} use:enhance={submit}>
				<p>{brief.mode === 'local' ? 'The local parser summarized the chart.' : providerNames[brief.mode] + ' ordered these findings.'}</p>
				<button class="button secondary" type="submit" name="mode" value={rankingProvider} disabled={pending}>Order findings with {providerNames[rankingProvider]}</button>
			</form>
		</details>
	{/if}
	{#if pending}<p role="status">Ordering findings…</p>{/if}
	{#if networkError || response?.briefError}<p class="notice error" role="alert">{networkError || response?.briefError}</p>{/if}
</section>

<style>
	.chart-brief {padding:clamp(16px,3vw,28px);margin-bottom:18px;overflow-wrap:anywhere}
	header p,.options {color:var(--muted);font-size:14px}
	header p {margin-top:4px}
	.options {border-top:1px solid var(--line);margin-top:3px;padding-top:12px}
	summary {cursor:pointer}
	form {display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:6px}
</style>
