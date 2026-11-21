<script lang="ts">
	import type { PageData } from '../../routes/handoffs/$types';
	import ChartCitation from './ChartCitation.svelte';
	let { record, documents, administrative = false }: { administrative?: boolean; record: NonNullable<PageData['record']>; documents: PageData['chart']['documents'] } = $props();
	function sourceName(id: string) { return documents.find(doc => doc.id === id)?.title ?? id; }
	function openImage() { const target = document.getElementById('chart-image'); if (target instanceof HTMLDetailsElement) target.open = true; }
</script>
<section class="brief" id="verified-brief" tabindex="-1" aria-label="Chart summary">
	<div class="brief-head"><h2>Chart summary</h2><span class="method-chip">{record.summary.method === 'codex' ? 'Codex' : 'Local parser'} · {record.elapsedMs < 1000 ? record.elapsedMs + ' ms' : (record.elapsedMs / 1000).toFixed(1) + ' s'}</span></div>
	{#if record.summary.issues.length}<div class="notice issues" role="alert"><strong>Source verification needs review</strong><ul>{#each record.summary.issues as issue (issue)}<li>{issue}</li>{/each}</ul></div>{/if}
	{#snippet facts()}
	<dl class="brief-facts">
		{#each record.summary.facts as fact (fact.kind)}<div><dt>{fact.label}</dt><dd>{fact.text} <ChartCitation line={fact.line} /></dd></div>{/each}
	</dl>
	{/snippet}
	{#if administrative && record.summary.crossChecks?.length}
		<details class="clinical-details"><summary>Clinical details · {record.summary.facts.length} source-linked facts</summary>{@render facts()}</details>
	{:else}{@render facts()}{/if}
	{#if record.summary.imageReview}
		<details class="image-review"><summary>Image label check</summary><p>{record.summary.imageReview.text}</p><a class="line-ref" href="#chart-image" onclick={openImage}>View synthetic X-ray</a></details>
	{/if}
	{#if record.summary.crossChecks?.length}
		<details class="reconcile" open={administrative}><summary>Across visits</summary>
		{#each record.summary.crossChecks as check (check.label)}<div class="finding">
			<h4>{check.label}</h4><p>{check.result}</p><div class="citations">
				{#each check.evidence as ev (ev.documentId + ':' + ev.line)}<ChartCitation doc={ev.documentId} line={ev.line} label={sourceName(ev.documentId)} />{/each}
			</div>
		</div>{/each}</details>
	{/if}
</section>
