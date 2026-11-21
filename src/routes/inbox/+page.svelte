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
{#if !data.caseId}
	<header class="pagehead flow-title"><div><p class="kicker">{data.account?.name} · {data.role}</p><h1>My inbox</h1></div></header>
	{#if data.deliveries.length}<section class="paper-card inbox-list"><header><h2>{data.record && !finished ? 'Assigned to you' : 'Past assignments'}</h2><span>1 case</span></header>
		<a href={resolve('/inbox?case=ED-104')} class="case-row"><span class="patient-mark" aria-hidden="true">JV</span><span><small>ED-104 · Transfer</small><strong>Jordan Vale</strong><span>{finished ? 'Report review signed' : !data.record ? 'View your handoff history' : task?.text ?? 'Review handoff'}</span></span><span class="row-arrow" aria-hidden="true">→</span></a>
	</section>{:else}<section class="paper-card empty"><h2>Your inbox is clear</h2><p>Handoffs assigned to {data.account?.name} appear here.</p><a class="button secondary" href={resolve('/patients')}>Browse patient records</a></section>{/if}
{:else}
	<header class="pagehead flow-title"><div><a class="back-link" href={resolve('/inbox')}>← My inbox</a><h1>Jordan Vale</h1><p class="lead">ED-104 · {data.role} workspace</p></div></header>
	{#if form?.message || message}<p role="alert" class="notice error">{message || form?.message}</p>{/if}
	{#if data.record && current && data.document}
		<div class="case-layout"><div class="case-column">
		<form method="POST" use:enhance={submit} aria-busy={busy} class="paper-card action-card"><input type="hidden" name="caseId" value="ED-104"/><input type="hidden" name="version" value={data.record.version}/>
			<div class="action-bar"><p class="kicker">{finished ? 'Review complete' : 'Your next action'}</p><span class="owner-chip">{data.account?.name}</span></div>
			{#if finished && current.reviewed}<h2>Report review signed</h2><p>Recorded by {current.reviewed.reviewedBy}.</p>
			{:else}
				<h2>{data.role === 'Nurse' ? 'Check comparison image status' : 'Review the final report'}</h2>
				{#if data.role === 'Doctor' && impression}<ChartCitation doc={'documentId' in impression ? impression.documentId : 'ED-104'} line={impression.line} label="Read signed radiology impression" />{/if}
				{#if task}<p>{task.text} <ChartCitation line={task.line} label={data.role + ' assignment in transfer note'}/></p>{/if}
				<p class="small">Handoff from {current.signedBy}.</p>
				{#if plan}<div class="routing-context"><p class="kicker">Routing plan · {plan.savedBy}</p><p><strong>Priority</strong> <span class:raised-priority={plan.priority === 'urgent' || plan.priority === 'critical'}>{plan.priority ?? 'unspecified'}</span> · <strong>Impact</strong> {plan.impact || 'Unspecified'}</p>
					{#if plan.receivingFacility || plan.receivingDepartment}<p><strong>Planned destination</strong> {[plan.receivingFacility,plan.receivingDepartment].filter(Boolean).join(' · ')}</p>{/if}
				</div>{/if}
				{#if ordered && data.role === 'Nurse'}
					{#if !data.record.imageStatus}<label for="image-status">Observed status of the requested prior images</label><select id="image-status" name="imageStatus" required><option value="">Choose status</option><option value="arrived">Arrived</option><option value="still-pending">Still pending</option><option value="unable-to-confirm">Unable to confirm</option></select><button class="button" type="submit" formaction="?/recordImageStatus" disabled={busy}>Record image status</button>
					{:else}<p class="request-receipt">Image status recorded · {data.record.imageStatus.status.replaceAll('-',' ')}</p>{#if next}<div class="route-next"><p>{next.text} <ChartCitation line={next.line} label="Doctor assignment in transfer note" /></p><button type="submit" class="button" formaction="?/forward" name="taskId" value={next.id} disabled={busy}>Sign and send report to doctor</button></div>{/if}{/if}
				{:else if ordered && data.role === 'Doctor'}
					{#if data.record.imageStatus}<p class="request-receipt">Nursing update · Comparison images {data.record.imageStatus.status.replaceAll('-',' ')}</p>{/if}
					<button class="button" type="submit" formaction="?/signReview" disabled={busy}>Sign report review</button>
					<details class="return-menu"><summary>Return to administrative staff</summary><label for="return-reason">Reason for returning</label><textarea id="return-reason" name="reason" rows="2" maxlength="500"></textarea><button class="button secondary" type="submit" formaction="?/returnToAdmin" disabled={busy}>Return handoff to admin</button></details>
				{:else}
					{#if !current.acknowledgedAt}<button class="button" type="submit" formaction="?/acknowledge" disabled={busy}>Acknowledge receipt</button>{:else}<p class="request-receipt">Receipt acknowledged</p>{/if}
					{#if next}<div class="route-next"><p>{next.text} <ChartCitation line={next.line} label={next.role + ' instruction'}/></p><button class="button secondary" type="submit" formaction="?/forward" name="taskId" value={next.id} disabled={busy}>Sign and forward to {next.role.toLowerCase()}</button></div>{/if}
				{/if}
			{/if}
		</form>
		<div class="paper-card"><HandoffBrief record={data.record} documents={data.chart.documents}/></div>
		</div><div class="case-column">
			<HandoffDocument documents={data.chart.documents}/>
			<DeliveryHistory record={data.record}/>
		</div></div>
	{:else if data.deliveries.length}
		<section class="paper-card empty"><h2>Past handoffs</h2>
			{#each data.deliveries as item (item.id)}<div class="archived-delivery"><strong>Signed by {item.signedBy}</strong><p>{item.returned ? 'Returned to administrative staff · ' + item.returned.reason : 'Previously assigned to you.'}</p></div>{/each}
			<a class="button secondary" href={resolve('/handoffs')}>Open patient chart</a></section>
	{:else}<section class="paper-card empty"><h2>No assignment for this case</h2><a class="button secondary" href={resolve('/inbox')}>Return to my inbox</a></section>{/if}
{/if}
