<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EvidenceMapRow } from '../patient-map';
	import ChartCitation from './ChartCitation.svelte';

	let { rows, initialId = '' }: { rows: EvidenceMapRow[]; initialId?: string | null } = $props();
	let selectedId = $state('');
	let selected = $derived(rows.find(row => row.id === (selectedId || initialId))
		?? rows.find(row => row.id === 'radiology' || row.id === 'print-preference') ?? rows[0]);
</script>

<section class="evidence-map" aria-labelledby="evidence-map-title">
	<h2 id="evidence-map-title">Evidence map</h2>
	{#if selected}
		<p class="intro">Choose a finding to trace it to the chart and see who acted on it.</p>
		<div class="choices" role="group" aria-label="Chart findings">
			{#each rows as row (row.id)}
				<button type="button" aria-pressed={row.id === selected.id} onclick={() => selectedId = row.id}>{row.title}</button>
			{/each}
		</div>
		<div class="chain" aria-live="polite">
			<div class="node">
				<h3><span class="symbol paper" aria-hidden="true"></span>Source</h3>
				<ul class="sources">
					{#each selected.sources as source (source.documentId + ':' + source.line)}
						<li><ChartCitation doc={source.documentId} line={source.line} label={source.title + ' · line ' + source.line} /></li>
					{/each}
				</ul>
			</div>
			<span class="edge" aria-hidden="true"></span>
			<div class="node fact-node">
				<h3><span class="symbol dot" aria-hidden="true"></span>Finding</h3>
				<strong>{selected.title}</strong>
				<p>{selected.text}</p>
			</div>
			<span class="edge" aria-hidden="true"></span>
			<div class="node">
				<h3><span class="symbol task" aria-hidden="true">→</span>Action</h3>
				{#each selected.actions as action (action.title)}
					<div class="action">
						<strong>{action.title}</strong>
						<div class="action-state"><b>{action.status}</b><span>{action.person}</span></div>
						{#if action.detail}<p>{action.detail}</p>{/if}
						<ChartCitation doc={action.citation.documentId} line={action.citation.line} label="See supporting passage" />
						{#if action.history?.length}
							<details class="map-history">
								<summary>Assignment history</summary>
								<ol>{#each action.history as entry, index (index)}<li>{entry}</li>{/each}</ol>
							</details>
						{/if}
						{#if action.workspace === '/handoffs'}
							<a href={resolve('/handoffs')}>Open transfer workspace <span aria-hidden="true">↗</span></a>
						{:else if action.workspace === '/inbox/J-104'}
							<a href={resolve('/inbox/[patientId]', { patientId: 'J-104' })}>Open my assignment <span aria-hidden="true">↗</span></a>
						{/if}
					</div>
				{:else}
					<strong>Chart context</strong>
					<p>No action is linked to this finding.</p>
				{/each}
			</div>
		</div>
	{:else}
		<p class="intro">This chart has no verified findings to map.</p>
	{/if}
</section>

<style>
	.evidence-map { color: var(--ink, #161616); min-width: 0; }
	h2 { font-size: 1.42rem; letter-spacing: -.035em; margin: 0; }
	.intro { margin: .4rem 0 1rem; color: var(--muted, #555); }
	.choices { display: flex; flex-wrap: wrap; gap: .42rem; margin: 0 0 1rem; }
	.choices button { border: 1px solid #cdcdca; border-radius: 4px; padding: .48rem .7rem; font: inherit; font-size: .84rem; cursor: pointer; background: #fff; color: #373737; }
	.choices button:hover { border-color: #666; }
	.choices button[aria-pressed="true"] { color: white; background: #252525; border-color: #252525; }
	.choices button:focus-visible, a:focus-visible { outline: 2px solid #333; outline-offset: 3px; }
	.chain { display: grid; grid-template-columns: minmax(0, .91fr) 1.5rem minmax(0, 1fr) 1.5rem minmax(0, 1.12fr); align-items: stretch; }
	.node { min-width: 0; background: #fff; border: 1px solid #c9c9c7; border-radius: 4px; padding: .9rem; overflow-wrap: anywhere; }
	.node.fact-node { background: #f6f6f4; }
	h3 { display: flex; align-items: center; gap: .48rem; margin: 0 0 .85rem; font-size: .79rem; font-weight: 600; color: #505050; }
	.symbol { display: inline-grid; place-items: center; box-sizing: border-box; width: .87rem; height: .87rem; }
	.paper { width: .65rem; height: .81rem; border: 1px solid; box-shadow: -2px 2px 0 0 #fff, -3px 3px 0 0 #555; margin-left: .15rem; }
	.dot { width: .58rem; height: .58rem; border-radius: 100%; background: #333; }
	.task { border: 1px solid; font-size: .72rem; line-height: 1; }
	.edge { align-self: center; height: 1px; border-top: 1px dashed #848482; position: relative; }
	.edge::after { content: ''; position: absolute; right: 2px; top: -3px; width: 4px; height: 4px; border: solid #777; border-width: 1px 1px 0 0; transform: rotate(45deg); }
	.sources { list-style: none; padding: 0; margin: 0; display: grid; gap: .52rem; }
	.node strong { display: block; font-size: .97rem; font-weight: 650; }
	.node p, .action-state { margin: .42rem 0 0; font-size: .86rem; line-height: 1.5; }
	.action { display: grid; justify-items: start; gap: .5rem; }
	.action + .action { border-top: 1px solid #ddd; margin-top: .7rem; padding-top: .7rem; }
	.action p, .action-state { margin: 0; }
	.action-state { display: flex; flex-wrap: wrap; align-items: baseline; gap: .35rem .5rem; color: #555; }
	.action-state b { padding: .06rem .3rem; border: 1px solid #cfcfcd; border-radius: 3px; color: #333; font-size: .74rem; }
	.map-history { font-size: .83rem; }
	.map-history summary { cursor: pointer; font-weight: 600; }
	.map-history ol { margin: .4rem 0 0; padding-left: 1.25rem; }
	.map-history li { padding: .12rem 0; }
	.action a { color: #222; font-size: .86rem; font-weight: 650; }
	@media (max-width: 760px) {
		.chain { grid-template-columns: minmax(0, 1fr); }
		.node { padding: .8rem .9rem; }
		.edge { width: 1px; height: 1rem; margin-left: 1.4rem; border-top: 0; border-left: 1px dashed #848482; }
		.edge::after { left: -3px; top: auto; bottom: 2px; transform: rotate(135deg); }
		h3 { margin-bottom: .5rem; }
	}
</style>
