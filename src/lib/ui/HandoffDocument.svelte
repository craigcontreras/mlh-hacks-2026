<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import type { ChartDocument } from '../server/chart';
	import SourceRecord from './SourceRecord.svelte';
	import transferText from '../../../samples/records/ED-104-transfer-note.txt?raw';
	import radiologyText from '../../../samples/records/ED-104-radiology.txt?raw';
	import physicianText from '../../../samples/records/ED-116-physician.txt?raw';

	let { documents, overviews, viewerOnly = false }: { documents: ChartDocument[]; overviews: Record<string, { id: string; text: string; lines: number[] }[]>; viewerOnly?: boolean } = $props();
	const visits = $derived([...new Map(documents.map(doc => [doc.visitId, doc.date])).entries()].sort((a,b) => b[1].localeCompare(a[1])));
	const formatDate = new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'});
	const dialogId = $props.id();
	let selected = $state<ChartDocument | 'image'>();
	let activeLine = $state<number>();
	let returnFocus: HTMLElement | undefined;
	const title = $derived(selected === 'image' ? 'Left ankle X-ray' : selected?.title);
	const pdfSources: Record<string, string> = { 'ED-104-radiology': radiologyText, 'ED-116-physician': physicianText };

	async function openSource(source: ChartDocument | 'image', line?: number, trigger?: HTMLElement) {
		selected = source;
		activeLine = line;
		returnFocus = trigger;
		await tick();
		const dialog = document.getElementById(dialogId) as HTMLDialogElement;
		const scrollArea = dialog.querySelector<HTMLDivElement>('.source-scroll')!;
		if (!dialog.open) dialog.showModal();
		scrollArea.scrollTop = 0;
		if (source !== 'image' && line !== undefined) {
			scrollArea.querySelector('#chart-' + source.id + '-L' + line)?.scrollIntoView({block:'center'});
		}
	}

	function onClose() {
		selected = undefined;
		returnFocus?.focus();
		returnFocus = undefined;
	}

	onMount(() => {
		function inspect(event: Event) {
			const { doc, line, trigger } = (event as CustomEvent<{doc:string;line?:number;trigger?:HTMLElement}>).detail;
			if (doc === 'image') {
				if (documents.some(item => item.visitId === 'ED-104')) void openSource('image', undefined, trigger);
				return;
			}
			const source = documents.find(item => item.id === doc);
			if (source) void openSource(source, line, trigger);
		}
		window.addEventListener('intake-view-source', inspect);
		return () => window.removeEventListener('intake-view-source', inspect);
	});
</script>

{#if !viewerOnly}
<aside class="chart-files paper-card" aria-label="Visit history and documents">
	<div class="workhead"><h2>Visits &amp; documents</h2><span class="source-count">{visits.length} visits</span></div>
	{#each visits as [visitId, day], visitIndex (visitId)}
		<section class="visit-group">
			<div class="visit-head"><p class="kicker">{visitId === 'ED-104' ? 'Current visit' : visitIndex === 0 ? 'Latest visit' : 'Prior visit'} · {visitId}</p><h3>{formatDate.format(new Date(day + 'T12:00:00Z'))}</h3></div>
			{#each documents.filter(doc => doc.visitId === visitId) as doc (doc.id)}
				<details class="chart-file" name="chart-overview">
					<summary><span class="case-icon" aria-hidden="true"></span><strong>{doc.title}</strong><span class="caret" aria-hidden="true">›</span></summary>
					<div class="overview">
						<p class="overview-label">Document summary</p>
						<ul aria-label="Summary findings">
							{#each overviews[doc.id] ?? [] as finding (finding.id)}
								<li>{finding.text}
									{#each finding.lines as line (line)}
										<button type="button" class="text-button" aria-label={`View line ${line} for ${finding.text}`} onclick={event => openSource(doc, line, event.currentTarget)}>See {finding.lines.length > 1 ? 'line ' + line : 'passage'}</button>
									{/each}
								</li>
							{:else}
								<li>Open the source document to read this record.</li>
							{/each}
						</ul>
						<button type="button" class="text-button" onclick={event => openSource(doc, undefined, event.currentTarget)}>View source document</button>
					</div>
				</details>
			{/each}
			{#if visitId === 'ED-104'}
				<details class="chart-file" name="chart-overview">
					<summary><span class="image-icon" aria-hidden="true">▧</span><strong>Left ankle X-ray</strong><span class="caret" aria-hidden="true">›</span></summary>
					<div class="overview"><p>Current visit · Synthetic AP and lateral views</p>
						<button type="button" class="text-button" onclick={event => openSource('image', undefined, event.currentTarget)}>View X-ray image</button>
					</div>
				</details>
			{/if}
		</section>
	{/each}
</aside>
{/if}

<dialog id={dialogId} onclose={onClose} aria-labelledby="source-view-title" class="source-dialog">
	<header class="source-toolbar">
		<div><p class="kicker">{selected === 'image' ? 'Image attachment' : 'Source document'}</p><h2 id="source-view-title">{title ?? 'Source document'}</h2></div>
		<button type="button" class="button secondary" onclick={event => event.currentTarget.closest('dialog')?.close()}>Close</button>
	</header>
	{#if selected && selected !== 'image'}
		<div class="source-meta">
			{#if activeLine}<span><mark></mark> Cited passage · Line {activeLine}</span>{/if}
			{#if selected.id === 'ED-104' && selected.text === transferText}<a href={resolve('/handoffs/source?format=pdf')} target="_blank" rel="noopener">Open transfer PDF</a>
			{:else if pdfSources[selected.id] === selected.text}
				<a href={resolve('/samples/[filename]', {filename: selected.id + '.pdf'})} download={selected.id + '.pdf'}>Download original PDF</a>
			{/if}
		</div>
	{/if}
	<div class="source-scroll">
		{#if selected === 'image'}
			<figure class="image-paper">
				<img src={resolve('/handoffs/source?format=image')} alt="Synthetic left ankle X-ray for the current visit, shown in AP and lateral views" />
				<figcaption>Current visit ED-104 · Synthetic illustration</figcaption>
			</figure>
		{:else if selected}
			<SourceRecord doc={selected} {activeLine} />
		{/if}
	</div>
</dialog>

<style>
	.overview { padding: 2px 8px 12px 25px; color: var(--muted); font-size: 14px; }
	.overview .overview-label { font-size: 12px; font-weight: 650; color: var(--ink); }
	.overview .text-button { margin-top: 6px; }
	.overview ul { padding-left: 16px; }
	.overview li { margin-top: 5px; }
	.overview li .text-button { margin: 0 0 0 3px; }
	.source-dialog {
		width: min(800px, calc(100% - 26px)); max-width: none;
		max-height: calc(100dvh - 32px); padding: 0; border-radius: 12px;
		background: #f2f2f2; color: var(--ink); border: 1px solid #b6b6b6;
		box-shadow: 0 24px 70px #26262652; overflow: hidden;
	}
	.source-dialog[open] { display: flex; flex-direction: column; }
	.source-dialog::backdrop { background: #292929c0; }
	.source-toolbar, .source-meta {
		display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
		gap: 8px 16px; padding: 14px 18px; background: var(--paper);
	}
	.source-toolbar { border-bottom: 1px solid var(--line); flex-shrink: 0; }
	.source-toolbar h2 { margin-top: 3px; font-size: 21px; }
	.source-meta { color: var(--muted); font-size: 13px; flex-shrink: 0; padding-block: 8px; }
	.source-meta mark { display: inline-block; width: 10px; height: 10px; margin-right: 3px; background: #e5e5e5; }
	.source-scroll { min-height: 0; overflow: auto; padding: clamp(8px,3vw,22px); overscroll-behavior: contain; }
	.image-paper { margin: 0; }
	.image-paper img { display: block; max-height: 68dvh; max-width: 100%; margin: auto; object-fit: contain; border-radius: 6px; }
	.image-paper figcaption { padding-top: 9px; text-align: center; color: var(--muted); font-size: 13px; }
</style>
