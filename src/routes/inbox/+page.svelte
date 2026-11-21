<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
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
<header class="pagehead"><div><p class="kicker">Receiving workspace</p><h1>Worker inbox</h1><p class="lead">Review an approved handoff, acknowledge receipt, or sign the next documented task.</p></div></header>
<nav class="role-switch" aria-label="Worker inbox role">
	{#each ['Doctor','Nurse'] as role (role)}
		<a href={resolve(`/inbox?role=${role}`)} aria-current={role === data.role ? 'page' : undefined}>{role} inbox</a>
	{/each}
</nav>
{#if form?.message || requestError}<p class="notice error" role="alert">{requestError || form?.message}</p>{/if}
{#if data.document && data.record && data.deliveries.length}
	<div class="handoff-grid">
		<section class="paper-card handoff-card" aria-label={'Handoffs delivered to ' + data.role}>
			<div class="workhead"><div><p class="kicker">{data.document.id} · {data.role} inbox</p><h2>{data.document.patient}</h2></div><span class="tag green">Approved handoff</span></div>
			{#each data.deliveries as event (event.id)}
				{@const task = data.record.summary.tasks.find(item => item.id === event.taskId)}
				<div class="incoming-task"><p class="kicker">Assigned task</p>
					{#if task}<h3>{task.text}</h3><a class="line-ref" href={'#line-' + task.line}>View source line {task.line}</a>{/if}
					<p class="small">Signed by {event.signedBy} for {event.recipient}.</p>
					{#if event.acknowledgedAt}<span class="tag green">Receipt acknowledged</span>{:else if event.id !== current?.id}<span class="tag">Forwarded</span>{/if}
				</div>
			{/each}
			{#if current && current.recipient !== data.role}
				<div class="forward-receipt" role="status"><div><p class="kicker">Signed onward handoff</p><strong>Forwarded to {current.recipient.toLowerCase()}</strong></div>
					<a class="button secondary" href={resolve(`/inbox?role=${current.recipient}`)}>Open {current.recipient.toLowerCase()} inbox</a>
				</div>
			{/if}
			<HandoffBrief record={data.record} />
			{#if current?.recipient === data.role}
				<form method="POST" class="handoff-sign" use:enhance={submit} aria-busy={busy}>
					<input type="hidden" name="version" value={data.record.version} />
					<input type="hidden" name="role" value={data.role} />
					{#if !current.acknowledgedAt}
						<h3>Confirm receipt</h3><p class="small">Record that the {data.role.toLowerCase()} received this handoff.</p>
						<button type="submit" class="button" formaction={'?/acknowledge&role=' + data.role} disabled={busy}>Acknowledge receipt</button>
					{/if}
					{#each next as task (task.id)}<div class="forward-task"><p class="kicker">Next documented task · {task.role}</p>
						<p>{task.text} <a class="line-ref" href={'#line-' + task.line}>Line {task.line}</a></p>
						<button type="submit" class="button secondary" formaction={'?/forward&role=' + data.role} name="taskId" value={task.id} disabled={busy}>Sign and forward to {task.role.toLowerCase()}</button>
					</div>{/each}
					{#if current.acknowledgedAt && next.length === 0}<p class="small">All documented tasks have been routed. The signed history is available below.</p>{/if}
				</form>
			{/if}
			<DeliveryHistory record={data.record} />
		</section>
		<HandoffDocument note={data.document} />
	</div>
{:else}
	<section class="empty paper-card"><span class="tray-mark" aria-hidden="true"></span><h2>No handoffs for the {data.role.toLowerCase()} yet</h2><p>A signed task appears here when a reviewer routes it to this role.</p><a class="button secondary" href={resolve('/handoffs')}>Open handoff review</a></section>
{/if}
