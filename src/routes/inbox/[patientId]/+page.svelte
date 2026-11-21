<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import ChartCitation from '#lib/ui/ChartCitation.svelte';
	import HandoffBrief from '#lib/ui/HandoffBrief.svelte';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	import DeliveryHistory from '#lib/ui/DeliveryHistory.svelte';
	import '#lib/ui/flow.css';
	let {data,form}:PageProps = $props();
	let busy = $state(false);
	let message = $state('');
	const current = $derived(data.record?.history.at(-1));
	const task = $derived(data.record?.summary.tasks.find(item => item.id === current?.taskId));
	const ordered = $derived(data.record?.flow === 'admin-nurse-doctor');
	const next = $derived(data.record?.summary.tasks.find(task => task.role !== data.role && !data.record?.history.some(item => item.taskId === task.id)));
	const plan = $derived(data.record?.carePlans?.findLast(entry => entry.visitId === 'ED-104'));
	const impression = $derived(data.record?.summary.crossChecks?.flatMap(check => check.evidence).find(item => item.documentId === 'ED-104-radiology') ?? data.record?.summary.facts.find(fact => fact.kind === 'impression'));
	const finished = $derived(data.record?.status === 'reviewed');
	const submit: SubmitFunction = ({cancel}) => {
		if (busy) { cancel(); return; }
		busy = true; message = '';
		return async ({result,update}) => {
			try {
				if(result.type === 'error') message = 'The request could not finish. Reload the inbox and retry.';
				else await update({reset:false});
			} finally { busy=false; }
		};
	};
</script>

<svelte:head><title>{data.role} inbox · Intake Desk</title></svelte:head>
	<header class="pagehead flow-title"><div><a class="back-link" href={resolve('/inbox')}>← My inbox</a><h1>{data.patient.name}</h1><p class="lead">{data.patient.visitId} · {data.role} workspace</p></div></header>
	{#if form?.message || message}<p role="alert" class="notice error">{message || form?.message}</p>{/if}
	{#if data.record && current}
		<div class="case-layout"><div class="case-column">
		<form method="POST" use:enhance={submit} aria-busy={busy} class="paper-card action-card"><input type="hidden" name="version" value={data.record.version}/>
			<div class="action-bar"><p class="kicker">{finished && !data.followup ? 'Review complete' : 'Your next action'}</p><span class="owner-chip">{data.account?.name}</span></div>
			{#if data.followup && data.record.imageFollowup}
				<h2>Check outstanding comparison images</h2>
				<p>{data.record.imageFollowup.openedBy} signed the report review. Check whether the earlier images have arrived.</p>
				{#if data.record.imageStatus}<p class="request-receipt">Last recorded status · {data.record.imageStatus.status.replaceAll('-',' ')}</p>{/if}
				<label for="followup-status">Comparison image status</label>
				<select name="imageStatus" id="followup-status" required><option value="">Choose status</option><option value="arrived">Arrived</option><option value="still-pending">Still pending</option><option value="unable-to-confirm">Unable to confirm</option></select>
				<button class="button" type="submit" formaction="?/followup" disabled={busy}>Save follow-up status</button>
			{:else if finished && current.reviewed}<h2>Report review signed</h2><p>Recorded by {current.reviewed.reviewedBy}.</p>
				{#if data.record.imageFollowup && !data.record.imageFollowup.resolvedAt}<p>Image follow-up assigned to {data.record.imageFollowup.recipientName}.</p>{/if}
			{:else}
				<h2>{data.role === 'Nurse' ? 'Check comparison image status' : 'Review the final report'}</h2>
			{/if}
			{#if data.role === 'Doctor' && data.record.imageStatus}
				<p class="request-receipt">Nursing update · Comparison images {data.record.imageStatus.status.replaceAll('-',' ')}<br /><small>Last recorded by {data.record.imageStatus.recordedBy}.</small></p>
			{/if}
			{#if !finished || !current.reviewed}
				{#if data.role === 'Doctor' && impression}<ChartCitation doc={'documentId' in impression ? impression.documentId : 'ED-104'} line={impression.line} label="Read signed radiology impression" />{/if}
				<p class="small">Handoff from {current.signedBy}.</p>
				{#if task}<ChartCitation line={task.line} label={data.role + ' assignment in transfer note'}/>{/if}
				{#if plan}<div class="routing-context"><p class="kicker">Routing plan · {plan.savedBy}</p><p><strong>Priority</strong> <span class:raised-priority={plan.priority === 'urgent' || plan.priority === 'critical'}>{plan.priority ?? 'unspecified'}</span> · <strong>Impact</strong> {plan.impact || 'Unspecified'}</p>
					{#if plan.receivingFacility || plan.receivingDepartment}<p><strong>Planned destination</strong> {[plan.receivingFacility,plan.receivingDepartment].filter(Boolean).join(' · ')}</p>{/if}
				</div>{/if}
				{#if ordered && data.role === 'Nurse'}
					{#if !data.record.imageStatus}<label for="image-status">Observed status of the requested prior images</label><select id="image-status" name="imageStatus" required><option value="">Choose status</option><option value="arrived">Arrived</option><option value="still-pending">Still pending</option><option value="unable-to-confirm">Unable to confirm</option></select><button class="button" type="submit" formaction="?/recordImageStatus" disabled={busy}>Record image status</button>
					{:else}
						<p class="request-receipt">Image status recorded · {data.record.imageStatus.status.replaceAll('-',' ')}</p>
						{#if next}
							<div class="route-next">
								<p>{next.text} <ChartCitation line={next.line} label="Doctor assignment in transfer note" /></p>
								<p>Receiving doctor · <strong>{data.nextDoctor}</strong></p>
								<button type="submit" class="button" formaction="?/forward" name="taskId" value={next.id} disabled={busy}>Sign and send report to doctor</button>
							</div>
						{/if}
					{/if}
				{:else if ordered && data.role === 'Doctor'}
					{#if data.record.imageStatus && data.record.imageStatus.status !== 'arrived'}<p class="small">Signing sends the outstanding image check back to {data.record.imageStatus.recordedBy}.</p>{/if}
					<button class="button" type="submit" formaction="?/signReview" disabled={busy}>Sign report review</button>
					<details class="return-menu"><summary>Return to administrative staff</summary><label for="return-reason">Reason for returning</label><textarea id="return-reason" name="reason" rows="2" maxlength="500"></textarea><button class="button secondary" type="submit" formaction="?/returnToAdmin" disabled={busy}>Return handoff to admin</button></details>
				{:else}
					{#if !current.acknowledgedAt}<button class="button" type="submit" formaction="?/acknowledge" disabled={busy}>Acknowledge receipt</button>{:else}<p class="request-receipt">Receipt acknowledged</p>{/if}
					{#if next}<div class="route-next"><p>{next.text} <ChartCitation line={next.line} label={next.role + ' instruction'}/></p><button class="button secondary" type="submit" formaction="?/forward" name="taskId" value={next.id} disabled={busy}>Sign and forward to {next.role.toLowerCase()}</button></div>{/if}
				{/if}
			{/if}
		</form>
		<div class="paper-card"><HandoffBrief record={data.record} documents={data.documents}/></div>
		</div><div class="case-column">
			<HandoffDocument documents={data.documents}/>
			<DeliveryHistory record={data.record}/>
		</div></div>
	{:else if data.completions.length}
		<div class="case-layout"><section class="paper-card action-card"><p class="kicker">Past assignment</p><h2>Paperwork confirmation recorded</h2>
			{#each data.completions as event (event.id)}<p>{event.text}</p>
				{#if event.documentId && event.line}<ChartCitation doc={event.documentId} line={event.line} label="Read signed receipt" />{/if}
			{/each}
			<p><a href={resolve(`/patients?patient=${encodeURIComponent(data.patient.patientId)}`)}>Open patient record</a></p>
		</section><HandoffDocument documents={data.documents}/></div>
	{:else if data.deliveries.length}
		<section class="paper-card empty"><h2>Past handoffs</h2>
			{#if data.closedFollowup}<p class="request-receipt">Comparison images arrived · Follow-up closed by {data.closedFollowup.by}.</p>{/if}
			{#each data.deliveries as item (item.id)}<div class="archived-delivery"><strong>Signed by {item.signedBy}</strong><p>{item.returned ? 'Returned to administrative staff · ' + item.returned.reason : 'Previously assigned to you.'}</p></div>{/each}
			<a class="button secondary" href={resolve('/handoffs')}>Open patient chart</a></section>
	{:else}<section class="paper-card empty"><h2>No assignment for this case</h2><a class="button secondary" href={resolve('/inbox')}>Return to my inbox</a></section>{/if}
