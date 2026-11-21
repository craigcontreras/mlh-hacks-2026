<script lang="ts">
	import { resolve } from '$app/paths';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	import ChartCitation from '#lib/ui/ChartCitation.svelte';
	import ChartBrief from '#lib/ui/ChartBrief.svelte';
	import PatientUpdate from '#lib/ui/PatientUpdate.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const documentationCase = $derived(data.matches.find(patient => patient.id === 'C-116'));
	const reviewCase = $derived(data.matches.find(patient => patient.id === 'J-104'));
	const visitDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
	const timestamp = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });

	function recordedAt(value: string) {
		return value.length === 10 ? visitDate.format(new Date(value + 'T12:00:00Z')) : timestamp.format(new Date(value));
	}

	function portalUrl(patient = '', mine = data.mine, query = data.query) {
		const params = new URLSearchParams({
			...(patient && { patient }),
			...(mine && { scope: 'mine' }),
			...(query && { q: query })
		});
		return params.size ? resolve(`/patients?${params}`) : resolve('/patients');
	}
</script>

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
			</div>
		</header>
		<section class="paper-card current" id="current-work" aria-label="Current work">
			<div><p class="kicker">Current work</p><h2>{data.patient.status}</h2>
				{#if data.patient.owner}<p class="muted">Owner · {data.patient.owner}</p>{/if}
			</div>
			{#if data.patient.workspace}
				<a class="button" href={data.patient.workspace === '/handoffs' ? resolve('/handoffs') : resolve('/inbox/[patientId]', {patientId: data.patient.id})}>{data.patient.workspace.startsWith('/inbox') ? 'Open my assignment' : 'Open transfer workspace'}</a>
			{/if}
		</section>
		{#if data.patient.clinicalUpdate}
			{@const clinical = data.patient.clinicalUpdate}
			<section class="paper-card observation" aria-label="Documented finding">
				<p class="kicker">Documented finding</p>
				<p>{clinical.text}</p>
				<footer><time datetime={clinical.at}>{recordedAt(clinical.at)}</time>
					{#if clinical.documentId && clinical.line}<ChartCitation doc={clinical.documentId} line={clinical.line} label={clinical.source}/>{/if}
				</footer>
			</section>
		{/if}
		<div class="record-layout">
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
			<div class="source-column">
				<ChartBrief patientId={data.patient.id} result={form} />
				<HandoffDocument documents={data.documents} />
			</div>
		</div>
	{/key}
{:else}
	<header class="pagehead"><div><p class="kicker">Mossbridge Community Hospital</p><h1>Patient overview</h1></div></header>
	{#if !data.query && !data.mine && documentationCase && reviewCase}
		<section class="workflows" aria-labelledby="workflows-heading">
			<h2 id="workflows-heading">Hospital workflows</h2>
			<nav aria-label="Hospital workflows">
				<ul>
					<li><a href="#chart-search"><span class="node-title"><i aria-hidden="true"></i>Patient records</span>
						<small>{data.matches.length} patients in the directory</small><span class="node-action">Find a chart <b aria-hidden="true">→</b></span></a></li>
					<li><a href={resolve(`/patients?patient=${documentationCase.id}#patient-log`)}><span class="node-title"><i aria-hidden="true"></i>Care documentation</span>
						<small>{documentationCase.name} · Nursing and physician notes</small><span class="node-action">Read patient log <b aria-hidden="true">→</b></span></a></li>
					<li><a href={resolve(`/patients?patient=${reviewCase.id}#current-work`)}><span class="node-title"><i aria-hidden="true"></i>Review routing</span>
						<small>{reviewCase.name} · {reviewCase.status}</small><span class="node-action">View current work <b aria-hidden="true">→</b></span></a></li>
				</ul>
			</nav>
		</section>
	{/if}
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
	.workflows {--connector:clamp(20px,3vw,42px);margin:0 0 28px}
	.workflows h2 {margin-bottom:12px;font-size:19px}
	.workflows ul {list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--connector)}
	.workflows li {position:relative}
	.workflows li:not(:last-child)::after {content:'';position:absolute;top:50%;left:100%;width:var(--connector);border-top:2px dotted #85868a}
	.workflows a {display:flex;flex-direction:column;gap:8px;position:relative;height:100%;min-height:128px;padding:18px 18px 12px;border:1px solid #96989b;border-radius:2px;text-decoration:none;background:var(--paper);color:var(--ink)}
	.workflows a:hover {border-color:var(--ink);background:#f1f1f2}
	.node-title {display:flex;align-items:center;gap:9px;font-size:19px;font-weight:650;letter-spacing:-.035em;line-height:1.25}
	.node-title i {width:8px;height:8px;flex:none;border-radius:50%;background:#18191b}
	.workflows li:nth-child(2) i {background:#65676a}
	.workflows li:nth-child(3) i {background:#a2a3a6}
	.workflows small {font-size:13px;color:var(--muted)}
	.node-action {display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid var(--line);padding-top:7px;margin-top:auto;font-size:12px;font-weight:650}
	.node-action b {font-size:17px;line-height:1}
	.observation {padding:16px 20px;margin-bottom:18px}
	.observation > p:nth-child(2) {font-size:17px;margin-block:4px 8px}
	.observation footer {display:flex;flex-wrap:wrap;gap:6px 15px;align-items:center}
	.observation time {font-size:12px;color:var(--muted)}
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
	.source-column {display:grid;gap:16px}
	.record-layout {display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:20px;align-items:start}
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
		.workflows {--connector:12px}
		.workflows ul {grid-template-columns:1fr}
		.workflows li:not(:last-child)::after {top:100%;left:22px;height:var(--connector);width:0;border-top:0;border-left:2px dotted #85868a}
		.workflows a {min-height:0;gap:2px;padding:9px 13px}
		.workflows small {padding-right:19px}
		.node-action {border:0;font-size:0;padding:0}
		.node-action b {position:absolute;right:12px;top:11px}
		.node-title {font-size:16px}
		.record-layout {grid-template-columns:1fr}
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
