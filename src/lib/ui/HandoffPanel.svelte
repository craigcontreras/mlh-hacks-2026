<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from '../../routes/handoffs/$types';
	import ChartCitation from './ChartCitation.svelte';

	let { data, message }: { data: PageData; message?: string } = $props();
	let busy = $state('');
	let error = $state('');
	const record = $derived(data.record);
	const admin = $derived(data.account?.role === 'Administrative staff');
	const delivery = $derived(record?.history.at(-1));
	const nurseTask = $derived(record?.summary.tasks.find(task => task.id === 'check-images'));
	const plan = $derived(record?.carePlans?.findLast(item => item.visitId === 'ED-104'));
	const returned = $derived(record?.status === 'returned');
	const reviewed = $derived(record?.status === 'reviewed');
	const owner = $derived(!delivery || returned ? 'Administrative staff' : delivery.recipientName ?? delivery.recipient);
	const ownsDelivery = $derived(delivery && !returned && (delivery.recipientAccountId ? delivery.recipientAccountId === data.account?.id : delivery.recipient === data.account?.role));
	const submit: SubmitFunction = ({submitter,cancel}) => {
		if (busy) { cancel(); return; }
		busy = submitter?.getAttribute('value') || 'saving';
		error = '';
		return async ({result,update}) => {
			try {
				if (result.type === 'error') error = 'The request could not finish. Reload the transfer and retry.';
				else await update({reset:false});
			} finally { busy = ''; }
		};
	};
</script>

{#if message || error}<p class="notice error" role="alert">{error || message}</p>{/if}
<form method="POST" use:enhance={submit} aria-busy={Boolean(busy)} class="paper-card action-card">
	<input type="hidden" name="version" value={data.version} />
	<div class="action-bar"><p class="kicker">{reviewed ? 'Review complete' : 'Next action'}</p><span class="owner-chip">{reviewed ? 'Signed' : 'Owner · ' + owner}</span></div>
	{#if !record}
		<h2>Prepare the transfer brief</h2><p>Read the current and prior visit together before routing the handoff.</p>
		<div class="buttons"><button class="button" type="submit" formaction="?/summarize" name="mode" value="codex" disabled={Boolean(busy)}>{busy === 'codex' ? 'Summarizing…' : 'Summarize with Codex'}</button>
		<button class="button secondary" type="submit" formaction="?/summarize" name="mode" value="local" disabled={Boolean(busy)}>Use local parser</button></div>
	{:else if returned && delivery?.returned}
		<h2>Reassign the report review</h2><p>{delivery.returned.returnedBy} returned this handoff to administrative staff.</p>
		<blockquote>{delivery.returned.reason}</blockquote>
		{#if plan && (plan.priority !== 'unspecified' || plan.impact)}<div class="routing-context"><p class="kicker">Staff routing context · {plan.savedBy}</p>
			{#if plan.priority !== 'unspecified'}<p><strong>Coordination priority</strong> <span class:raised-priority={plan.priority === 'urgent' || plan.priority === 'critical'}>{plan.priority}</span></p>{/if}
			{#if plan.impact}<p><strong>Impact</strong> {plan.impact}</p>{/if}
		</div>{/if}
		{#if admin}<label for="replace-doctor">New receiving doctor</label>
			<select id="replace-doctor" name="doctorId" required><option value="">Choose a doctor</option>{#each data.doctors.filter(doctor => doctor.id !== delivery?.recipientAccountId) as doctor (doctor.id)}<option value={doctor.id}>{doctor.name}</option>{/each}</select>
			<button type="submit" class="button" formaction="?/reassign" disabled={Boolean(busy)}>Sign and reassign</button>{/if}
	{:else if reviewed && delivery?.reviewed}
		<h2>Report review signed</h2><p>{delivery.reviewed.reviewedBy} signed the review for this transfer.</p>
	{:else if delivery}
		<h2>{delivery.recipient === 'Nurse' ? 'Check comparison image status' : 'Review the signed report'}</h2>
		<p>Sent by {delivery.signedBy} to {owner}. {record.imageStatus ? 'The nurse has recorded the comparison image status.' : ''}</p>
		{#if ownsDelivery}<a class="button" href={resolve('/inbox?case=ED-104')}>Open my assignment</a>{/if}
	{:else if record.summary.issues.length}
		<h2>Resolve source verification</h2><p>Review the flagged evidence or regenerate the brief with the local parser.</p>
		<button class="button secondary" type="submit" formaction="?/summarize" name="mode" value="local" disabled={Boolean(busy)}>Retry with local parser</button>
	{:else if admin}
		<h2>{record.priorStudyRequest || !record.summary.adminAction ? 'Send the handoff to nursing' : 'Request the prior comparison study'}</h2>
		{#if record.summary.adminAction && !record.priorStudyRequest}
			<p>{record.summary.adminAction.text}</p>
			{#each record.summary.adminAction.evidence.slice(0,1) as ev (ev.documentId + ev.line)}<ChartCitation line={ev.line} doc={ev.documentId} label="Clerk instruction" />{/each}
			<div class="buttons"><button class="button" type="submit" formaction="?/requestPriorStudy" disabled={Boolean(busy)}>Request study from Imaging Records</button></div>
		{/if}
		{#if record.priorStudyRequest}<p class="request-receipt">Imaging Records request queued · {record.priorStudyRequest.accession} · {record.priorStudyRequest.requestedBy}</p>{/if}
		{#if nurseTask}<div class="route-next"><div><span class="kicker">Receiving nurse</span><p>{nurseTask.text} <ChartCitation line={nurseTask.line} label="Nurse instruction" /></p></div>
			<button class="button" class:secondary={Boolean(record.summary.adminAction && !record.priorStudyRequest)} type="submit" formaction="?/approve" name="taskId" value={nurseTask.id} disabled={Boolean(busy)}>Sign and send to nurse</button></div>{/if}
	{:else}
		<h2>Awaiting administrative handoff</h2><p>Administrative staff will route the documented follow-up to nursing.</p>
	{/if}
	{#if delivery && admin && record?.summary.adminAction && !record.summary.issues.length}
		<details class="return-menu"><summary>Records follow-up{record.priorStudyRequest ? ' · Queued' : ''}</summary>
			{#if record.priorStudyRequest}<p class="small">Study {record.priorStudyRequest.accession} requested by {record.priorStudyRequest.requestedBy}.</p>
			{:else}<p class="small">{record.summary.adminAction.text}</p><button class="button secondary" type="submit" formaction="?/requestPriorStudy" disabled={Boolean(busy)} formnovalidate>Request study from Imaging Records</button>{/if}
		</details>
	{/if}
	{#if busy}<span class="sr" role="status">Processing request.</span>{/if}
</form>
