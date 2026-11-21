<script lang="ts">
	import type { PageData } from '../../routes/desk/$types';
	import { fieldLabels, fieldOrder } from './fields';

	let { receipt }: { receipt: PageData['receipts'][number] } = $props();
	const dateFormat = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric',
		hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
	});
</script>

<article class="receipt paper-card">
	<div class="receipt-head">
		<div><p class="kicker">{receipt.packetId}</p><h2>{receipt.values.patient.value}</h2></div>
		<span class="tag green">Approved</span>
	</div>
	<dl class="receipt-fields">
		{#each fieldOrder as field (field)}
			<div>
				<dt>{fieldLabels[field]}</dt><dd>{receipt.values[field].value}</dd>
				<dd class="receipt-source">
					<span>{receipt.values[field].documentTitle ?? receipt.values[field].documentId} · line {receipt.values[field].line}</span>
					<q>{receipt.values[field].quote}</q>
				</dd>
			</div>
		{/each}
	</dl>
	<div class="receipt-foot">
		<div><p class="kicker">Triage agent sign-off</p><strong>{receipt.reviewer}</strong><br/><time datetime={receipt.approvedAt}>{dateFormat.format(new Date(receipt.approvedAt))}</time></div>
		<div><p class="kicker">Destination</p><strong>{receipt.destination}</strong><br/>{receipt.method === 'codex' ? 'Codex extraction' : 'Local parser'}</div>
	</div>
</article>
