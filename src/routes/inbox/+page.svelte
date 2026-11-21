<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import ChartCitation from '#lib/ui/ChartCitation.svelte';
	import HandoffBrief from '#lib/ui/HandoffBrief.svelte';
	import HandoffDocument from '#lib/ui/HandoffDocument.svelte';
	import DeliveryHistory from '#lib/ui/DeliveryHistory.svelte';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	let requestError = $state('');
	const current = $derived(data.record?.history.at(-1));
	const used = $derived(new Set(data.record?.history.map(item => item.taskId)));
	const next = $derived(data.record?.summary.tasks.filter(task => task.role !== data.role && !used.has(task.id)) ?? []);
	const submit: SubmitFunction = ({cancel}) => {
		if (busy) { cancel(); return; }
		busy = true;
		requestError = '';
		return async ({result, update}) => {
			try {
				if (result.type === 'error') requestError = 'The request could not finish. Refresh the inbox and retry.';
				else await update({reset:false});
			} finally { busy = false; }
		};
	};
</script>

<svelte:head><title>{data.role} inbox · Intake Desk</title></svelte:head>
<header class="pagehead"><div><p class="kicker">{data.account?.name} · {data.role}</p><h1>My inbox</h1><p class="lead">Review assigned work and sign the next handoff.</p></div><span class="count">{data.deliveries.length} {data.deliveries.length === 1 ? 'handoff' : 'handoffs'}</span></header>
{#if form?.message || requestError}<p class="notice error" role="alert">{requestError || form?.message}</p>{/if}
{#if data.document && data.chart && data.record && data.deliveries.length}
	<div class="handoff-grid">
		<section class="paper-card handoff-card" aria-label={'Handoffs delivered to ' + data.role}>
			<div class="workhead"><div><p class="kicker">{data.document.id} · {data.role} inbox</p><h2>{data.document.patient}</h2></div><span class="tag green">Approved handoff</span></div>
			{#each data.deliveries as event (event.id)}
				{@const task = data.record.summary.tasks.find(item => item.id === event.taskId)}
				<div class="incoming-task"><p class="kicker">Assigned task</p>
					{#if task}<h3>{task.text}</h3><ChartCitation line={task.line} />{/if}
					<p class="small">Signed by {event.signedBy} for {event.recipient}.</p>
					{#if event.acknowledgedAt}<span class="tag green">Receipt acknowledged</span>{:else if event.id !== current?.id}<span class="tag">Forwarded</span>{/if}
				</div>
			{/each}
			{#if current && current.recipient !== data.role}
				<div class="forward-receipt" role="status"><div><p class="kicker">Signed onward handoff</p><strong>Forwarded to {current.recipient.toLowerCase()}</strong></div>
					<span class="tag green">Routed</span>
				</div>
			{/if}
			<HandoffBrief record={data.record} documents={data.chart.documents} />
			{#if current?.recipient === data.role}
				<form method="POST" class="handoff-sign" use:enhance={submit} aria-busy={busy}>
					<input type="hidden" name="version" value={data.record.version} />

					{#if !current.acknowledgedAt}
						<h3>Confirm receipt</h3><p class="small">Record receipt as {data.account?.name}.</p>
						<button type="submit" class="button" formaction="?/acknowledge" disabled={busy}>Acknowledge receipt</button>
					{/if}
					{#each next as task (task.id)}<div class="forward-task"><p class="kicker">Next documented task · {task.role}</p><p class="small">Sign as {data.account?.name}</p>
						<p>{task.text} <ChartCitation line={task.line} /></p>
						<button type="submit" class="button secondary" formaction="?/forward" name="taskId" value={task.id} disabled={busy}>Sign and forward to {task.role.toLowerCase()}</button>
					</div>{/each}
					{#if current.acknowledgedAt && next.length === 0}<p class="small">All documented tasks have been routed. The signed history is available below.</p>{/if}
				</form>
			{/if}
			<DeliveryHistory record={data.record} />
		</section>
		<HandoffDocument documents={data.chart.documents} />
	</div>
{:else if data.deliveries.length}
	<section class="paper-card empty"><h2>Past handoffs</h2><p>These tasks were delivered to your inbox. Their signed receipt remains available here.</p>
		{#each data.deliveries as event (event.id)}<div class="archived-delivery"><strong>Transfer ED-104 · {event.recipient}</strong><p class="small">Signed by {event.signedBy}</p>{#if event.acknowledgedAt}<span class="tag green">Receipt acknowledged{event.acknowledgedBy ? ' by ' + event.acknowledgedBy : ''}</span>{:else}<span class="tag">Previously received</span>{/if}</div>{/each}
		<a class="button secondary" href={resolve('/handoffs')}>Open Jordan Vale’s chart</a>
	</section>
{:else}
	<section class="empty paper-card"><span class="tray-mark" aria-hidden="true"></span><h2>Your inbox is clear</h2><p>New tasks appear here when a handoff is routed to the {data.role.toLowerCase()}.</p><a class="button secondary" href={resolve('/handoffs')}>Open Jordan Vale’s chart</a></section>
{/if}
