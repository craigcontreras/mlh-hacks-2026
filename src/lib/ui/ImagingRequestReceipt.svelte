<script lang="ts">
	import type { ImagingNotice } from '../server/imaging-notice';
	import ChartCitation from './ChartCitation.svelte';

	let { request }: { request: ImagingNotice } = $props();
	const hospitalTime = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
		hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
	});
	const checklist = $derived(request.evidence.find(ref => ref.quote.startsWith('Clerk instruction:'))
		?? request.evidence.find(ref => ref.documentId === 'ED-104-registration'));
	const archive = $derived(request.evidence.find(ref => ref.documentId === 'ED-082-study'));
	const deliveryLabels = {
		'matched-delivery': 'Incoming file matched and filed',
		'source-reply': 'Availability confirmed in the transfer checklist',
		'staff-observation': 'Availability recorded by staff'
	};
</script>

<details class="receipt">
	<summary>{request.requestedAt ? 'View request' : request.status === 'received' ? 'View file receipt' : 'Review file match'}</summary>
	<div class="envelope">
		<h3>{request.recipient} <small>Local demo inbox</small></h3>
		{#if request.requestedAt && request.requestedBy && request.requestBody}
			<dl>
				<dt>From</dt><dd>{request.requestedBy}</dd>
				<dt>To</dt><dd>{request.recipient}</dd>
				<dt>Subject</dt><dd>Earlier X-ray for Jordan Vale · {request.accession}</dd>
				<dt>Queued</dt><dd><time datetime={request.requestedAt}>{hospitalTime.format(new Date(request.requestedAt))}</time></dd>
			</dl>
			<p>{request.requestBody}</p>
		{:else if request.status === 'received'}
			<p>The earlier X-ray was available when the chart was checked.</p>
		{/if}
		{#if request.status === 'received' && request.receivedVia && request.receivedAt}
			<p class="state">{deliveryLabels[request.receivedVia]} · <time datetime={request.receivedAt}>{hospitalTime.format(new Date(request.receivedAt))}</time></p>
		{:else if request.status === 'requested'}
			<p class="state">Awaiting the earlier X-ray</p>
		{:else}
			<p class="state">{request.message}</p>
		{/if}
		{#if checklist || archive}
			<div class="sources">
				{#if checklist}<ChartCitation doc={checklist.documentId} line={checklist.line} label={'Transfer checklist · line ' + checklist.line} />{/if}
				{#if archive}<ChartCitation doc={archive.documentId} line={archive.line} label={'Earlier imaging archive · line ' + archive.line} />{/if}
			</div>
		{/if}
	</div>
</details>

<style>
	.receipt {margin-block:.5rem;font-size:.87rem;line-height:1.45}
	summary {width:fit-content;cursor:pointer;font-weight:650;text-decoration:underline;text-underline-offset:3px}
	summary:focus-visible {outline:2px solid currentColor;outline-offset:3px}
	.envelope {margin-block:.55rem;padding:.8rem 1rem;border:1px solid var(--line,#d4d4d4);border-radius:5px;background:white;overflow-wrap:anywhere}
	h3 {display:flex;align-items:baseline;flex-wrap:wrap;gap:.5rem;margin:0;font-size:1rem}
	small,dt {color:var(--muted,#555);font-weight:500}
	dl {display:grid;grid-template-columns:auto 1fr;gap:.15rem .8rem;margin:.55rem 0}
	dd,p {margin:0}
	.state {margin-top:.65rem;font-weight:600}
	.sources {display:flex;flex-wrap:wrap;gap:.1rem .9rem;margin-top:.3rem}
</style>
