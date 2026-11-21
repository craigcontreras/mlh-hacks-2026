<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from '../../routes/$types';
	import Receipt from './Receipt.svelte';
	import { fieldLabels, fieldOrder } from './fields';

	let { data, message }: { data: PageData; message?: string } = $props();
	let chosen = $state('');
	let pending = $state('');
	let transportError = $state('');
	const record = $derived(data.record);
	const draft = $derived(record?.draft);
	const distinctCallbacks = $derived(new Set(draft?.candidates.callback.map((item) => item.value.trim())).size);
	const conflict = $derived(distinctCallbacks > 1);
	const hasAllFields = $derived(draft && fieldOrder.every((field) => draft.candidates[field].length > 0));
	const ready = $derived(record?.status === 'review' && draft && !draft.issues.length && hasAllFields &&
		(!conflict || (!!draft.correctionRef && chosen === draft.correctionRef)));
	const status = $derived(!record ? 'Ready to parse' : record.status === 'approved' ? 'Approved' :
		record.status === 'held' ? 'On hold' : draft?.issues.length ? 'Review blocked' : ready ? 'Ready for sign-off' : 'Needs review');
	const method = $derived(draft?.method === 'codex' ? 'Codex' : 'Local labeled-text parser');

	function documentLabel(id: string) {
		return data.packet.documents.find((doc) => doc.id === id)?.title ?? id;
	}
	const submit: SubmitFunction = ({ submitter, cancel }) => {
		if (pending) { cancel(); return; }
		pending = submitter?.getAttribute('value') || submitter?.getAttribute('formaction') || 'working';
		transportError = '';
		return async ({ result, update }) => {
			try {
				if (result.type === 'error') transportError = 'The request could not finish. Your packet is still available. Please retry.';
				else await update({reset: false});
			} finally { pending = ''; }
		};
	};
</script>

<form class="packet-form" method="POST" use:enhance={submit} aria-busy={Boolean(pending)}>
	<input type="hidden" name="sampleId" value={data.sampleId} />
	<input type="hidden" name="version" value={record?.version ?? ''} />
	{#if message || transportError}<p class="notice error" role="alert">{transportError || message}</p>{/if}
	<div class="work-grid">
		<section class="paper-card draft-pane" aria-label="Intake packet">
			<div class="pane-head">
				<div><p class="kicker">{data.packet.id}</p><h2>Registration draft</h2></div>
				<span class:green={ready || record?.status === 'approved'} class:amber={status === 'Needs review' || status === 'Review blocked'} class="tag" role="status">{status}</span>
			</div>
			{#if !record}
				<div class="section-block extract-start">
					<span class="tray-mark" aria-hidden="true"></span>
					<h3>Extract the intake fields</h3>
					<p>Read the bundled documents for the patient name, sending facility, and callback extension. You’ll review the source lines before signing off.</p>
					<button type="submit" class="button" formaction={'?/extract&sample=' + data.sampleId} name="mode" value="local" disabled={Boolean(pending)}>{pending === 'local' ? 'Parsing…' : 'Parse'}</button>
				</div>
			{:else if record.status === 'approved' && record.receipt}
				<div class="section-block"><h3>Sent to the registration desk</h3><p class="muted">The receiving desk has the approved values and their source references.</p><a class="button" href={resolve('/desk')}>Open registration desk</a></div>
				<details class="receipt-disclosure"><summary>View signed handoff</summary><Receipt receipt={record.receipt} /></details>
			{:else if record.status === 'held'}
				<div class="section-block"><h3>Awaiting clarification</h3><p class="muted">Intake is holding this packet. Resume review when you’re ready to check the source documents.</p>
					{#if draft?.issues.length}<ul class="issue-list">{#each draft.issues as issue (issue)}<li>{issue}</li>{/each}</ul>{/if}
					<button type="submit" class="button" formaction={'?/resume&sample=' + data.sampleId} disabled={Boolean(pending)}>Resume review</button>
				</div>
			{:else if draft}
				<div class="method-line"><span class="small">Extraction method</span><strong>{method}{draft.model ? ' · ' + draft.model : ''}</strong></div>
				{#if draft.issues.length}
					<div class="notice issues" role="status"><strong>This draft needs clarification</strong><ul>{#each draft.issues as issue (issue)}<li>{issue}</li>{/each}</ul>
					</div>
				{/if}
				<div class="fields">
					{#each fieldOrder as field (field)}
						{@const candidates = draft.candidates[field]}
						{#if field === 'callback' && conflict}
							<fieldset class="decision">
								<legend>{fieldLabels[field]}</legend><p class="small">{draft.correctionRef ? 'The sources disagree. Choose the documented correction or hold for clarification.' : 'The sources disagree and neither documents a replacement. Hold this packet for clarification.'}</p>
								<div class="options">
									{#each candidates as candidate (candidate.ref)}
										<label class="option"><input type="radio" name="selectedRef" value={candidate.ref} disabled={!draft.correctionRef} bind:group={chosen} />
											<span><strong>{candidate.value}</strong><small>{documentLabel(candidate.documentId)} · line {candidate.line}</small><q>{candidate.quote}</q></span>
										</label>
									{/each}
								</div>
								{#if chosen}
									{#if chosen !== draft.correctionRef}<p class="inline-warning" role="status">This source does not establish a replacement. Review the documents or hold the packet.</p>{/if}
									<button type="button" class="text-button" onclick={() => chosen = ''}>Clear selection</button>
								{/if}
							</fieldset>
						{:else}
							<div class="matched"><p class="small">{fieldLabels[field]}</p>
								{#if candidates.length}
									<strong>{Array.from(new Set(candidates.map((item) => item.value.trim()))).join(' / ')}</strong>
									<details class="evidence-mini"><summary>Source evidence ({candidates.length})</summary>
										{#each candidates as c (c.ref)}<p><b>{documentLabel(c.documentId)} · line {c.line}</b> <q>{c.quote}</q></p>{/each}
									</details>
								{:else}<strong>No verified value</strong>{/if}
							</div>
						{/if}
					{/each}
				</div>
				<div class="sign-area">
					<p class="kicker">Triage agent sign-off</p>
					<p id="sign-help">{ready ? 'Approve as ' + (data.account?.name ?? 'the reviewing triage agent') + ' to send these reviewed values to the registration desk.' : draft.issues.length || !hasAllFields ? 'Resolve the listed issues before this packet can be approved.' : 'Select the documented correction to enable approval.'}</p>
					<div class="buttons">
						<button class="button" type="submit" formaction={'?/approve&sample=' + data.sampleId} aria-describedby="sign-help" disabled={!ready || Boolean(pending)}>Approve for registration desk</button>
						<button class="button secondary" type="submit" formaction={'?/hold&sample=' + data.sampleId} disabled={Boolean(pending)}>Hold for clarification</button>
					</div>
				</div>
			{/if}
		</section>
		<aside class="sources" aria-label="Packet evidence">
			<div class="sources-head"><h2>Source documents</h2><span class="source-count">{data.packet.documents.length}</span></div>
			{#each data.packet.documents as doc (doc.id)}
				<article class="source-paper">
					<div class="doc-title"><h3>{doc.title}</h3><time>{doc.time}</time></div>
					<ol class="source-lines">{#each doc.text.split('\n') as line, index (index)}<li>{line || ' '}</li>{/each}</ol>
				</article>
			{/each}
		</aside>
	</div>
	{#if record}
		<details class="demo-setting"><summary>Demo controls</summary><p>Reset this synthetic sample to replay it. Its saved draft and handoff will be removed.</p>
			<div class="buttons">
				<button type="submit" class="button secondary" formaction={'?/reset&sample=' + data.sampleId} disabled={Boolean(pending)}>Reset this sample</button>
				{#if record.status === 'review'}
					<button type="submit" class="button secondary" formaction={'?/extract&sample=' + data.sampleId} name="mode" value="local" disabled={Boolean(pending)}>{pending === 'local' ? 'Parsing…' : 'Parse'}</button>
				{/if}
			</div>
		</details>
	{/if}
	<p class="sr" role="status">{pending === 'local' ? 'Parsing packet documents.' : ''}</p>
</form>
