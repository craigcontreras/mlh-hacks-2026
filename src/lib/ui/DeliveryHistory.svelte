<script lang="ts">
	import type { PageData } from '../../routes/handoffs/$types';
	let { record }: { record: NonNullable<PageData['record']> } = $props();
	const time = new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'});
	const log = $derived.by(() => {
		const rows: {key:string; at:string; text:string}[] = [];
		for (const item of record.history) {
			rows.push({key:item.id,at:item.sentAt,text:item.signedBy + ' routed to ' + (item.recipientName ?? item.recipient)});
			if (item.acknowledgedAt) rows.push({key:item.id+'-receipt',at:item.acknowledgedAt,text:(item.acknowledgedBy ?? item.recipient) + ' acknowledged receipt'});
			if (item.returned) rows.push({key:item.id+'-return',at:item.returned.returnedAt,text:item.returned.returnedBy + ' returned to admin · ' + item.returned.reason});
			if (item.reviewed) rows.push({key:item.id+'-review',at:item.reviewed.reviewedAt,text:item.reviewed.reviewedBy + ' signed report review'});
		}
		for (const note of record.operationalNotes ?? []) rows.push({key:note.id,at:note.savedAt,text:note.savedBy + ' saved a coordination note for ' + note.visitId + ' · ' + note.text});
		for (const plan of record.carePlans ?? []) rows.push({key:plan.id,at:plan.savedAt,text:plan.savedBy + ' updated the plan for ' + plan.visitId + ' · ' + (plan.receivingFacility || 'Facility unassigned') + ' · ' + (plan.doctorName || 'Doctor unassigned') + (plan.receivingDepartment ? ' · ' + plan.receivingDepartment : '') + (plan.priority && plan.priority !== 'unspecified' ? ' · ' + plan.priority + ' priority' : '') + (plan.impact ? ' · ' + plan.impact : '')});
		if (record.priorStudyRequest) rows.push({key:'request',at:record.priorStudyRequest.requestedAt,text:record.priorStudyRequest.requestedBy + ' queued study ' + record.priorStudyRequest.accession + ' for Imaging Records'});
		if (record.imageStatus) rows.push({key:'images',at:record.imageStatus.recordedAt,text:record.imageStatus.recordedBy + ' recorded image status · ' + record.imageStatus.status.replaceAll('-',' ')});
		return rows.sort((a,b)=>b.at.localeCompare(a.at));
	});
</script>
{#if log.length}<details class="paper-card audit"><summary>Activity history <span>{log.length}</span></summary><ol>{#each log as row (row.key)}<li><time datetime={row.at}>{time.format(new Date(row.at))}</time><p>{row.text}</p></li>{/each}</ol></details>{/if}
