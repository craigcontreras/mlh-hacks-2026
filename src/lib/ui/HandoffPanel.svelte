<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { PageData } from '../../routes/handoffs/$types';
	import HandoffBrief from './HandoffBrief.svelte';
	import ChartCitation from './ChartCitation.svelte';
	import DeliveryHistory from './DeliveryHistory.svelte';

	let { data, message }: { data: PageData; message?: string } = $props();
	let taskId = $state('');
	let busy = $state('');
	let requestError = $state('');
	const record = $derived(data.record);
	const admin = $derived(data.account?.role === 'Administrative staff');
	const chosenTask = $derived(record?.summary.tasks.find(task => task.id === taskId));
	const delivery = $derived(record?.history.at(-1));
	const task = $derived(record?.summary.tasks.find(item => item.id === delivery?.taskId));
	function title(id:string) { return data.chart.documents.find(doc => doc.id === id)?.title ?? id; }
	const submit: SubmitFunction = ({submitter, cancel}) => {
		if (busy) { cancel(); return; }
		busy = submitter?.getAttribute('value') || 'saving';
		requestError = '';
		return async ({result, update}) => {
			try {
				if (result.type === 'error') requestError = 'The request could not finish. Check the current handoff and retry.';
				else await update({reset: false});
			} finally { busy = ''; }
		};
	};
</script>

<form method="POST" use:enhance={submit} class="handoff-panel" aria-busy={Boolean(busy)}>
	<input type="hidden" name="version" value={data.version} />
	{#if message || requestError}<p class="notice error" role="alert">{requestError || message}</p>{/if}
	<section class="paper-card handoff-card">
		<div class="workhead"><div><p class="kicker">{data.chart.patient.id} · Current visit {data.document.id}</p><h2>{data.chart.patient.name}</h2></div><span class="tag" class:green={Boolean(delivery)}>{delivery ? 'Routed' : record ? 'Summary ready' : 'Awaiting summary'}</span></div>
		{#if !record}
			<div class="prepare-body"><h3>Review this transfer</h3><p>Summarize the current paperwork and earlier visit to find pending records and documented next steps.</p>
				<div class="buttons"><button class="button" type="submit" formaction="?/summarize" name="mode" value="codex" disabled={Boolean(busy)}>{busy === 'codex' ? 'Summarizing with Codex…' : 'Summarize with Codex'}</button>
				<button class="button secondary" type="submit" formaction="?/summarize" name="mode" value="local" disabled={Boolean(busy)}>{busy === 'local' ? 'Reading chart…' : 'Use local parser'}</button></div>
			</div>
		{:else}
			<HandoffBrief {record} documents={data.chart.documents} administrative={admin} />
			{#if record.summary.adminAction || record.priorStudyRequest}
				<section class="records-action" aria-label="Records follow-up">
					<p class="kicker">Records follow-up</p>
					{#if record.priorStudyRequest}
						<h3>Prior study request queued</h3><p>{record.priorStudyRequest.accession} · Imaging Records</p>
						<p class="small">Requested by {record.priorStudyRequest.requestedBy} on <time datetime={record.priorStudyRequest.requestedAt}>{new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(new Date(record.priorStudyRequest.requestedAt))}</time>.</p>
					{:else if record.summary.adminAction}
						<h3>Request prior study</h3><p>{record.summary.adminAction.text}</p>
						<div class="citations">{#each record.summary.adminAction.evidence as ev (ev.documentId + ':' + ev.line)}<ChartCitation doc={ev.documentId} line={ev.line} label={title(ev.documentId)} />{/each}</div>
						{#if admin && !record.summary.issues.length}<button type="submit" class="button" formaction="?/requestPriorStudy" disabled={Boolean(busy)}>Request study from Imaging Records</button>
						{:else if !admin}<p class="small">Assigned to administrative staff.</p>{/if}
					{/if}
				</section>
			{/if}
			{#if delivery}
				<div class="handoff-sign"><p class="kicker">Signed by {delivery.signedBy}</p><h3>Sent to {delivery.recipient.toLowerCase()} inbox</h3>
					{#if task}<p>{task.text} <ChartCitation line={task.line} /></p>{/if}
				</div><DeliveryHistory {record}/>
			{:else if record.summary.issues.length}
				<div class="handoff-sign"><p>Source verification needs review before routing.</p><button class="button secondary" type="submit" formaction="?/summarize" name="mode" value="local" disabled={Boolean(busy)}>Retry with local parser</button></div>
			{:else if admin}
				<section class="task-section"><fieldset><legend>Route a documented task</legend><p class="small">Choose which worker should receive this handoff.</p><div class="task-options">
					{#each record.summary.tasks as entry (entry.id)}<div class="task-option" class:active={taskId === entry.id}><label><input type="radio" name="taskId" value={entry.id} bind:group={taskId} /><span><small>To {entry.role.toLowerCase()}</small><strong>{entry.text}</strong></span></label><ChartCitation line={entry.line}/></div>{/each}
				</div></fieldset><div class="buttons"><button class="button" type="submit" formaction="?/approve" disabled={!chosenTask || Boolean(busy)}>{chosenTask ? 'Sign and send to ' + chosenTask.role.toLowerCase() : 'Sign and send'}</button><span class="small">Signed as {data.account?.name}</span></div></section>
			{/if}
			{#if !record.summary.crossChecks && record.status === 'draft'}<div class="section-block"><p class="small">This saved brief covers the original transfer note.</p><button type="submit" class="button secondary" formaction="?/summarize" name="mode" value="local" disabled={Boolean(busy)}>Refresh with current and prior visit</button></div>{/if}
		{/if}
	</section>
	{#if record && admin}<details class="demo-setting"><summary>Demo controls</summary><p>Reset this sample to clear its summary, request, and handoff history.</p><button type="submit" class="button secondary" formaction="?/reset" disabled={Boolean(busy)}>Reset handoff demo</button></details>{/if}
	<p class="sr" role="status">{busy === 'codex' ? 'Codex is reviewing the chart.' : busy === 'local' ? 'The local parser is reading the chart.' : ''}</p>
</form>
