<script lang="ts">
	import type { PageData } from '../../routes/handoffs/$types';
	import ChartCitation from './ChartCitation.svelte';

	let { record, documents }: {
		record: NonNullable<PageData['record']>;
		documents: PageData['chart']['documents'];
	} = $props();
	const factSources = {
		reason: 'Triage history in transfer note',
		report: 'Attached report in transfer note',
		impression: 'Impression in transfer note',
		pending: 'Imaging status in transfer note'
	};
	const comparisonSources: Record<string, string> = {
		'ED-104': 'ED transfer note',
		'ED-104-radiology': 'Signed radiology report',
		'ED-104-registration': 'Current transfer checklist',
		'ED-082-intake': 'Prior intake form',
		'ED-082-study': 'Prior imaging archive'
	};
	function sourceName(id: string) {
		return comparisonSources[id] ?? documents.find(doc => doc.id === id)?.title ?? 'View source';
	}
</script>

<section class="brief" id="verified-brief" aria-label="Chart summary">
	<div class="brief-head">
		<h2>Chart summary</h2>
		<span class="method-chip">{record.summary.method === 'codex' ? 'Codex' : 'Local parser'} · {record.elapsedMs < 1000 ? record.elapsedMs + ' ms' : (record.elapsedMs / 1000).toFixed(1) + ' s'}</span>
	</div>
	{#if record.summary.pdfInput}<p class="small">{record.summary.pdfInput === 'pdf-text' ? 'Read and verified the transfer note and radiology PDFs.' : 'Used verified transcripts of the transfer note and radiology PDFs.'}</p>{/if}
	{#if record.summary.issues.length}
		<div class="notice issues" role="alert"><strong>Source verification needs review</strong>
			<ul>{#each record.summary.issues as issue (issue)}<li>{issue}</li>{/each}</ul>
		</div>
	{/if}
	{#if record.summary.crossChecks?.length}
		<details class="reconcile">
			<summary>Compare current and prior records</summary>
			{#each record.summary.crossChecks as check (check.label)}
				<div class="finding">
					<h4>{check.label === 'Comparison images pending' ? 'Comparison images at transfer' : check.label}</h4>
					<p>{check.result}</p>
					<div class="citations">
						{#each check.evidence as evidence (evidence.documentId + ':' + evidence.line)}
							<ChartCitation doc={evidence.documentId} line={evidence.line} label={sourceName(evidence.documentId)} />
						{/each}
					</div>
				</div>
			{/each}
		</details>
	{/if}
	{#if record.summary.facts.length}
		<details class="reconcile">
			<summary>Transfer note findings</summary>
			<dl class="brief-facts">
				{#each record.summary.facts as fact (fact.kind)}
					<div><dt>{fact.kind === 'pending' ? 'Pending at transfer' : fact.label}</dt><dd>{fact.text}<br /><ChartCitation line={fact.line} label={factSources[fact.kind]} /></dd></div>
				{/each}
			</dl>
		</details>
	{/if}
	{#if record.summary.imageReview}
		<details class="reconcile image-review">
			<summary>Current X-ray label check</summary>
			<p>{record.summary.imageReview.text}</p>
			<ChartCitation doc="image" line={0} label="View current X-ray" />
		</details>
	{/if}
</section>
