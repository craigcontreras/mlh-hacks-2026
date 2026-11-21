<script lang="ts">
	import type { PageData } from '../../routes/handoffs/$types';
	let { record }: { record: NonNullable<PageData['record']> } = $props();
	const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });
</script>

<section class="history" aria-label="Handoff history">
	<h3>Handoff history</h3>
	<ol>{#each record.history as event (event.id)}
		<li><strong>{event.signedBy} → {event.recipient}</strong><time datetime={event.sentAt}>{formatter.format(new Date(event.sentAt))}</time>
			{#if event.acknowledgedAt}<small>Receipt acknowledged{event.acknowledgedBy ? ' by ' + event.acknowledgedBy : ''} <time datetime={event.acknowledgedAt}>{formatter.format(new Date(event.acknowledgedAt))}</time></small>{/if}
		</li>
	{/each}</ol>
</section>
