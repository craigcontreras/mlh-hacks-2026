<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from '../../routes/handoffs/$types';
	import HandoffBrief from './HandoffBrief.svelte';
	import DeliveryHistory from './DeliveryHistory.svelte';

	let { data, message }: { data: PageData; message?: string } = $props();
	let taskId = $state('');
	let reviewer = $state('');
	let busy = $state('');
	let requestError = $state('');
	const record = $derived(data.record);
	const chosenTask = $derived(record?.summary.tasks.find(task => task.id === taskId));
	const delivery = $derived(record?.history.at(-1));
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
	{#if !record}
		<section class="paper-card prepare">
			<div class="workhead"><div><p class="kicker">{data.document.id}</p><h2>{data.document.patient}</h2></div><span class="tag">Awaiting summary</span></div>
			<div class="prepare-body"><span class="tray-mark" aria-hidden="true"></span><h3>Prepare a handoff brief</h3>
				<p>Summarize the transfer note, check each fact against its source, and choose a documented follow-up for a worker to receive.</p>
				<div class="buttons">
					<button class="button" type="submit" formaction="?/summarize" name="mode" value="codex" disabled={Boolean(busy)}>{busy === 'codex' ? 'Summarizing with Codex…' : 'Summarize with Codex'}</button>
					<button class="button secondary" type="submit" formaction="?/summarize" name="mode" value="local" disabled={Boolean(busy)}>{busy === 'local' ? 'Reading the note…' : 'Use local parser'}</button>
				</div><p class="small">The local parser reads this bundled note offline.</p>
			</div>
		</section>
	{:else}
		<div class="paper-card handoff-card">
			<div class="workhead"><div><p class="kicker">{data.document.id}</p><h2>{data.document.patient}</h2></div><span class="tag" class:green={Boolean(delivery)}>{delivery ? 'Signed handoff' : 'Draft for review'}</span></div>
			<HandoffBrief {record} />
			{#if delivery}
				{@const task = record.summary.tasks.find(item => item.id === delivery.taskId)}
				<div class="handoff-sign"><p class="kicker">Signed by {delivery.signedBy}</p>
					<h3>Sent to {delivery.recipient.toLowerCase()} inbox</h3>
					{#if task}<p>{task.text} <a class="line-ref" href={'#line-' + task.line}>Line {task.line}</a></p>{/if}
					<a class="button" href={resolve(`/inbox?role=${delivery.recipient}`)}>Open {delivery.recipient.toLowerCase()} inbox</a>
				</div>
				<DeliveryHistory {record} />
			{:else if record.summary.issues.length}
				<div class="handoff-sign"><p>Resolve the source-verification issues before signing.</p><button class="button secondary" type="submit" formaction="?/summarize" name="mode" value="local" disabled={Boolean(busy)}>Retry with local parser</button></div>
			{:else}
				<div class="task-section"><fieldset><legend>Suggested handoff tasks</legend><p class="small">Choose one task documented in the transfer note.</p>
					<div class="task-options">{#each record.summary.tasks as task (task.id)}
						<div class="task-option" class:active={taskId === task.id}>
							<label><input type="radio" name="taskId" value={task.id} bind:group={taskId} /><span><small>To {task.role.toLowerCase()}</small><strong>{task.text}</strong></span></label>
							<a class="line-ref" href={'#line-' + task.line} aria-label={'View source line ' + task.line + ' for ' + task.role + ' task'}>Line {task.line}</a>
						</div>
					{/each}</div>
				</fieldset></div>
				<div class="handoff-sign"><fieldset><legend>Sign off as</legend><div class="role-inputs">
					{#each ['Doctor', 'Administrative staff'] as role (role)}<label><input type="radio" name="reviewer" value={role} bind:group={reviewer} /><span>{role}</span></label>{/each}
				</div></fieldset>
					<p class="small" id="approval-help">{!chosenTask ? 'Select a documented task and your reviewing role to enable routing.' : !reviewer ? 'Choose the role signing this handoff.' : reviewer + ' will sign this task for the ' + chosenTask.role.toLowerCase() + ' inbox.'}</p>
					<button type="submit" class="button" formaction="?/approve" aria-describedby="approval-help" disabled={!chosenTask || !reviewer || Boolean(busy)}>{chosenTask ? 'Approve and send to ' + chosenTask.role.toLowerCase() : 'Approve and send'}</button>
				</div>
			{/if}
		</div>
		<details class="demo-setting"><summary>Demo controls</summary><p>Reset this sample to clear its summary and handoff history.</p><button type="submit" class="button secondary" formaction="?/reset" disabled={Boolean(busy)}>Reset handoff demo</button></details>
	{/if}
	<p class="sr" role="status">{busy === 'codex' ? 'Codex is summarizing the synthetic transfer note.' : busy === 'local' ? 'The local parser is reading the note.' : ''}</p>
</form>
