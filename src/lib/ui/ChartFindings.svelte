<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ChartPoint } from '../server/chart-brief';
	import ChartCitation from './ChartCitation.svelte';

	let { items, patientId }: { items: ChartPoint[]; patientId?: string } = $props();
	const filters = $derived([...page.url.searchParams].filter(([key]) => key === 'scope' || key === 'q'));
	function mapUrl(patient: string, finding: string) {
		const params = new URLSearchParams([['patient', patient], ['tab', 'ontology'], ['finding', finding], ...filters]);
		return resolve(`/patients?${params}`);
	}
</script>

{#if items.length}
	<ul class="findings">
		{#each items as item (item.id)}
			<li>
				<strong>{#if patientId}<a href={mapUrl(patientId, item.id)} aria-label={'Trace ' + item.title + ' in the ontology'}>{item.title}<span aria-hidden="true"> ↗</span></a>{:else}{item.title}{/if}</strong>
				<p>{item.text}</p>
				{#if item.sources.length}
					<div class="sources">
						<ChartCitation doc={item.sources[0].documentId} line={item.sources[0].line} label={item.sources[0].title}/>
						{#if item.sources.length > 1}
							<details><summary>{item.sources.length - 1} more {item.sources.length === 2 ? 'passage' : 'passages'}</summary>
								{#each item.sources.slice(1) as source (source.documentId + ':' + source.line)}
									<ChartCitation doc={source.documentId} line={source.line} label={source.title + ' · line ' + source.line}/>
								{/each}
							</details>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">There is too little verified information in these documents to prepare a chart summary.</p>
{/if}

<style>
	.findings {list-style:disc;padding-left:1.2rem;margin-top:10px}
	li {padding:9px 0 10px 5px;overflow-wrap:anywhere}
	li + li {border-top:1px solid var(--line)}
	li::marker {color:#666}
	strong {font-size:15px}
	strong a {text-decoration:none;color:inherit}
	strong a:hover {text-decoration:underline}
	strong span {font-size:.83em;color:var(--muted)}
	p {margin:2px 0;line-height:1.5}
	.sources {display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 16px;margin-top:3px}
	summary {cursor:pointer;color:var(--muted);font-size:13px}
	details[open] {display:grid;justify-items:start;gap:2px}
</style>
