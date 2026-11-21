<script lang="ts">
	import { clinicalActivity } from '../clinical-activity';
	import type { PageData } from '../../routes/handoffs/$types';
	let { record }: { record: NonNullable<PageData['record']> } = $props();
	const time = new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'});
	const log = $derived(clinicalActivity(record, 'ED-104'));
</script>
{#if log.length}<details class="paper-card audit"><summary>Activity history <span>{log.length}</span></summary><ol>{#each log as row (row.id)}<li><time datetime={row.at}>{time.format(new Date(row.at))}</time><p>{row.text}</p></li>{/each}</ol></details>{/if}
