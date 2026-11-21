<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import EvidenceMap from '#lib/ui/EvidenceMap.svelte';
	import { resolve } from '$app/paths';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	import ChartCitation from '#lib/ui/ChartCitation.svelte';
	import ChartBrief from '#lib/ui/ChartBrief.svelte';
	import PatientUpdate from '#lib/ui/PatientUpdate.svelte';
	import SharedUploads from '#lib/ui/SharedUploads.svelte';
	import ImagingRequestReceipt from '#lib/ui/ImagingRequestReceipt.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let receiving = $state(false);
	const tabs = [['summary', 'Summary'], ['ontology', 'Ontology'], ['log', 'Patient log'], ['documents', 'Documents']];
	const section = $derived(tabs.find(([id]) => id === page.url.searchParams.get('tab'))?.[0] ?? (page.url.hash === '#patient-log' ? 'log' : 'summary'));
	const visitDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
	const timestamp = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });

	function recordedAt(value: string) {
		return value.length === 10 ? visitDate.format(new Date(value + 'T12:00:00Z')) : timestamp.format(new Date(value));
	}

	function portalUrl(patient = '', mine = data.mine, query = data.query, tab = 'summary', anchor = '') {
		const params = new URLSearchParams({
			...(patient && { patient }),
			...(tab !== 'summary' && { tab }),
			...(mine && { scope: 'mine' }),
			...(query && { q: query })
		});
		return params.size ? resolve(`/patients?${params}${anchor}`) : resolve('/patients');
	}
</script>

<svelte:window onfocus={() => {
	if (data.patient && section !== 'log') void refreshAll();
}} />
<svelte:head><title>{data.patient?.name ?? 'Patient overview'} · Intake Desk</title></svelte:head>

{#snippet entry(event: PageProps['data']['timeline'][number])}
	<div class="log-meta"><time datetime={event.at}>{recordedAt(event.at)}</time><span>{event.visitId}</span></div>
	<h3>{event.title}</h3>
	{#if event.text && event.text !== event.title}<p>{event.text}</p>{/if}
	{#if event.documentId && event.line}
		<ChartCitation doc={event.documentId} line={event.line} label={event.source === event.title ? 'View original passage' : event.source}/>
	{:else}<small>{event.source}</small>{/if}
{/snippet}

{#if data.patient}
	{#key data.patient.id}
		<a class="back-link" href={portalUrl()}>← Patient overview</a>
		<header class="pagehead">
			<div><p class="kicker">{data.patient.hospital} · Chart {data.patient.id}</p><h1>{data.patient.name}</h1>
				<p class="lead">{data.patient.visitCount} {data.patient.visitCount === 1 ? 'visit' : 'visits'} · Last visit {recordedAt(data.patient.lastVisit)}</p>
				{#if section !== 'documents' && data.fileInventory}
					<div class="file-cues">
						<a href={portalUrl(data.patient.id, data.mine, data.query, 'documents')}>End-of-day files · {data.fileInventory.available} of {data.fileInventory.expected} available <span aria-hidden="true">→</span></a>
						{#if data.imagingRequest}
							<a href={portalUrl(data.patient.id, data.mine, data.query, 'documents', '#imaging-request')}>
								{#if data.imagingRequest.status === 'requested'}Earlier X-ray requested{data.imagingRequest.requestedBy === 'Intake Desk' ? ' automatically' : ''}
								{:else if data.imagingRequest.status === 'received'}Earlier X-ray received
								{:else}Image request needs review{/if} <span aria-hidden="true">→</span>
							</a>
						{/if}
					</div>
				{/if}
			</div>
		</header>
		<nav class="chart-tabs" aria-label="Patient chart">
			{#each tabs as [id,label] (id)}
				<a href={portalUrl(data.patient.id, data.mine, data.query, id)} aria-current={section === id ? 'page' : undefined}>{label}</a>
			{/each}
		</nav>
		{#if section === 'ontology'}
			{#key page.url.searchParams.get('finding')}
				<EvidenceMap rows={data.evidenceMap} initialId={page.url.searchParams.get('finding') ?? ''} />
			{/key}
		{:else if section === 'log'}
			<section class="paper-card timeline" id="patient-log" aria-labelledby="log-heading">
				<header class="workhead"><h2 id="log-heading">Patient log</h2></header>
				{#if data.account?.role === 'Administrative staff' && data.updateRequestId}
					<PatientUpdate patientId={data.patient.id} documents={data.documents} requestId={data.updateRequestId} {form} />
				{/if}
				{#if data.timeline.length}
					<ol class="events">{#each data.timeline.slice(0, 5) as event (event.id)}<li>{@render entry(event)}</li>{/each}</ol>
					{#if data.timeline.length > 5}
						<details class="older"><summary>Earlier entries ({data.timeline.length - 5})</summary>
							<ol class="events" start="6">{#each data.timeline.slice(5) as event (event.id)}<li>{@render entry(event)}</li>{/each}</ol>
						</details>
					{/if}
				{:else}<p class="empty">No entries recorded.</p>{/if}
			</section>
		{:else if section === 'documents' && data.fileInventory}
			{@const inventory = data.fileInventory}
			<section class="file-check paper-card" aria-labelledby="files-heading">
				<p class="kicker">Hospital date · {recordedAt(inventory.date)}</p>
				<h2 id="files-heading">End-of-day file check</h2>
				<p><strong>{inventory.available} of {inventory.expected} expected files</strong> available to the care team.</p>
				{#if inventory.priorImage}
					<div class="file-exception">
						<strong>Earlier left ankle X-ray{inventory.priorImage.accession ? ' · ' + inventory.priorImage.accession : ''}</strong>
						<p><strong>{inventory.priorImage.status === 'available' ? 'Available.' : inventory.priorImage.status === 'pending' ? 'Awaiting images.' : 'Receipt unconfirmed.'}</strong> {inventory.priorImage.detail}</p>
						{#if inventory.priorImage.url}
							<ChartCitation doc="prior-image" line={0} label="Open earlier X-ray" />
						{:else if inventory.priorImage.owner}
							<p class="owner">Follow-up · {inventory.priorImage.owner}</p>
						{/if}
					</div>
				{/if}
				{#if data.imagingRequest}
					<div id="imaging-request">
						<ImagingRequestReceipt request={data.imagingRequest} />
						{#if data.deliveryVersion !== null && data.imagingRequest.status === 'requested' && data.imagingRequest.accession}
							<details class="demo-controls" open={Boolean(form?.deliveryError)}>
								<summary>Demo controls</summary>
								<form method="POST" action="?/receiveImagingDelivery&patient=J-104&tab=documents" use:enhance={({ cancel }) => {
									if (receiving) { cancel(); return; }
									receiving = true;
									return async ({ update }) => { try { await update(); } finally { receiving = false; } };
								}}>
									<input type="hidden" name="version" value={data.deliveryVersion}/>
									<input type="hidden" name="visitId" value="ED-104"/>
									<input type="hidden" name="accession" value={data.imagingRequest.accession}/>
									<p>For rehearsal, this supplies the imaging office’s reply with the earlier X-ray.</p>
									<button class="button secondary" disabled={receiving} type="submit">{receiving ? 'Filing image…' : 'Simulate file arrival'}</button>
								</form>
							</details>
						{/if}
						{#if form?.deliveryError}<p class="notice error" role="alert">{form.deliveryError}</p>{/if}
					</div>
				{/if}
				{#if inventory.missingDocuments.length}
					<ul aria-label="Outstanding documents">{#each inventory.missingDocuments as doc (doc.id)}
						<li>{doc.title} · {doc.visitId} · Awaiting file</li>
					{/each}</ul>
				{/if}
			</section>
		{:else if data.chartBrief}
			<ChartBrief patientId={data.patient.id} initial={data.chartBrief} result={form} />
			<section class="paper-card current" id="current-work" aria-label="Current work">
				<div><p class="kicker">Current work</p><h2>{data.patient.status}</h2>
					{#if data.patient.owner}<p class="muted">Owner · {data.patient.owner}</p>{/if}
				</div>
				{#if data.patient.workspace}
					<a class="button" href={data.patient.workspace === '/handoffs' ? resolve('/handoffs') : resolve('/inbox/[patientId]', {patientId: data.patient.id})}>{data.patient.workspace.startsWith('/inbox') ? 'Open my assignment' : 'Open transfer workspace'}</a>
				{/if}
			</section>
		{/if}
		<HandoffDocument overviews={data.overviews} documents={data.documents} priorImage={data.fileInventory?.priorImage} viewerOnly={section !== 'documents'} />
		{#if section === 'documents'}
			<SharedUploads patientId={data.patient.id} documents={data.documents} uploads={data.uploads} {form}/>
		{/if}
	{/key}
{:else}
	<header class="pagehead"><div><p class="kicker">Mossbridge Community Hospital</p><h1>Patient overview</h1><p class="lead">Open a chart to see the main findings, their sources and who has the next action.</p></div></header>
	<section class="paper-card roster" aria-label="Hospital patient list">
		<div class="tools">
			<nav aria-label="Patient list filter">
				<a href={portalUrl('', false)} aria-current={!data.mine ? 'page' : undefined}>All patients</a>
				<a href={portalUrl('', true)} aria-current={data.mine ? 'page' : undefined}>My assignments</a>
			</nav>
			<form method="GET" action={resolve('/patients')} role="search">
				{#if data.mine}<input type="hidden" name="scope" value="mine" />{/if}
				<label for="chart-search" class="sr">Find a patient by name, chart ID or visit ID</label>
				<input id="chart-search" type="search" name="q" value={data.query} placeholder="Name, chart ID or visit ID" />
				<button class="button secondary">Search</button>
				{#if data.query}<a href={portalUrl('', data.mine, '')}>Clear</a>{/if}
			</form>
		</div>
		{#if data.matches.length}
			<div class="columns grid" aria-hidden="true"><span>Patient</span><span>Documented finding</span><span>Current work</span><span></span></div>
			<ul class="rows">
				{#each data.matches as patient (patient.id)}
					<li><a class="row grid" aria-label={'Open chart for ' + patient.name} aria-describedby={'update-' + patient.id + ' work-' + patient.id} href={portalUrl(patient.id)}>
						<div class="identity"><strong>{patient.name}</strong><small>Chart {patient.id} · {patient.visitCount} {patient.visitCount === 1 ? 'visit' : 'visits'}</small></div>
						<div class="latest" id={'update-' + patient.id}>
							{#if patient.clinicalUpdate}<strong>{patient.clinicalUpdate.title}</strong><p>{patient.clinicalUpdate.text}</p><small><time datetime={patient.clinicalUpdate.at}>{recordedAt(patient.clinicalUpdate.at)}</time></small>
							{:else}<small>No clinical update recorded</small>{/if}
						</div>
						<div class="work" id={'work-' + patient.id}><strong>{patient.status}</strong>{#if patient.owner}<small>Owner · {patient.owner}</small>{/if}<small class="activity">Last entry · {patient.latest.title}</small></div>
						<span class="arrow" aria-hidden="true">→</span>
					</a></li>
				{/each}
			</ul>
		{:else}
			<div class="empty">
				{#if data.query}<h2>No patients match “{data.query}”</h2><a href={portalUrl('', data.mine, '')}>Clear search</a>
				{:else}<h2>No current assignments</h2><a href={portalUrl('', false)}>View all patients</a>{/if}
			</div>
		{/if}
	</section>
{/if}

<style>
	.file-cues {display:flex;flex-wrap:wrap;gap:5px 18px;margin-top:8px;font-size:14px;text-underline-offset:3px}
	#imaging-request {scroll-margin-top:20px}
	.demo-controls {margin-top:10px;color:var(--muted);font-size:13px}
	.demo-controls summary {width:fit-content;cursor:pointer;font-weight:600}
	.demo-controls form p {margin-block:7px}
	.file-check {padding:18px 22px;margin-bottom:16px}
	.file-check h2 {margin:3px 0}
	.file-check p:not(.kicker),.file-check li {font-size:14px}
	.file-check ul {margin:8px 0 0;padding-left:18px}
	.file-exception {margin-top:12px;padding:10px 0 0;border-top:1px solid var(--line);font-size:14px}
	.file-exception p {margin:3px 0}
	.file-exception .owner {font-weight:600}
	.chart-tabs {display:flex;gap:clamp(12px,3vw,32px);border-bottom:1px solid var(--line);margin-bottom:20px;flex-wrap:wrap}
	.chart-tabs a {text-decoration:none;color:var(--muted);padding:7px 0 10px;border-bottom:3px solid transparent;font-size:15px;font-weight:600}
	.chart-tabs a[aria-current] {color:var(--ink);border-color:var(--ink)}
	.activity {font-size:11px}
	.back-link {display:inline-block;margin-bottom:15px;font-size:14px}
	.roster {overflow:hidden}
	.tools,.tools form,.tools nav,.current {display:flex;flex-wrap:wrap;align-items:center;gap:10px}
	.tools,.current {justify-content:space-between;padding:17px 20px}
	.tools nav {gap:2px;background:#f0f0f1;border:1px solid var(--line);padding:3px;border-radius:8px}
	.tools nav a {padding:7px 12px;text-decoration:none;border-radius:5px;font-size:14px;font-weight:600}
	.tools nav a[aria-current] {background:var(--paper);box-shadow:0 1px 3px #15151526}
	.tools form a {font-size:13px}
	.tools form input[type=search] {font:inherit;font-size:14px;padding:9px 10px;border:1px solid #aaabad;border-radius:6px;color:var(--ink);width:clamp(170px,22vw,290px);height:42px}
	.grid {display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,1.65fr) minmax(125px,1fr) 16px;align-items:start;gap:clamp(10px,2vw,28px)}
	.columns,.row {padding:12px 22px}
	.columns {border-block:1px solid var(--line);background:#f4f4f5;color:var(--muted);font-weight:650;font-size:12px}
	.rows,.events {list-style:none}
	.rows li+li {border-top:1px solid var(--line)}
	.row {text-decoration:none;color:var(--ink);padding-block:20px;overflow-wrap:anywhere}
	.row:hover {background:#f6f6f6}
	.row:focus-visible {outline-offset:-3px}
	.identity strong {font-size:20px;line-height:1.25}
	.latest,.work {font-size:14px}
	.latest p {display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;margin-top:2px}
	.row small,.events small,.log-meta {display:block;font-size:12px;color:var(--muted)}
	.row small {margin-top:4px}
	.arrow {font-size:20px;align-self:center}
	.current {margin-bottom:18px;border-left:4px solid #66686c}
	.current h2 {font-size:22px;margin-block:3px}
	.current .muted {font-size:14px}
	.events {padding:1px 20px}
	.events li {border-left:2px solid #cccdce;padding:0 0 0 14px;margin:18px 0;overflow-wrap:anywhere}
	.log-meta {display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}
	.events h3 {font-size:17px}
	.events p {margin-block:3px;font-size:14px}
	.older {border-top:1px solid var(--line)}
	.older summary {padding:12px 20px;font-weight:600;font-size:14px;cursor:pointer}
	.empty {padding:24px}
	.empty h2 {font-size:20px;margin-bottom:8px}
	@media(max-width:760px) {
		.columns {display:none}
		.rows {border-top:1px solid var(--line)}
		.row {grid-template-columns:1fr 16px;gap:8px;padding:16px}
		.identity,.latest,.work {grid-column:1}
		.latest {grid-row:3}
		.work {grid-row:2}
		.arrow {grid-column:2;grid-row:1}
		.latest::before,.work::before {display:block;font-size:12px;color:var(--muted)}
		.latest::before {content:'Documented finding'}
		.work::before {content:'Current work'}
		.tools {padding:14px}
		.tools form {width:100%}
		.tools form input[type=search] {flex:1;min-width:100px}
	}
</style>
