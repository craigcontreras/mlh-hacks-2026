<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from '../../routes/handoffs/$types';
	import ChartCitation from './ChartCitation.svelte';

	let { data }: { data: PageData } = $props();
	let selected = $state('');
	let noteVisit = $state('ED-104');
	const admin = $derived(data.account?.role === 'Administrative staff');
	const route = $derived.by(() => {
		const history = data.record?.history ?? [];
		const nodes: {role:string; name:string; state:string}[] = [];
		if (history[0]?.assignmentOrigin === 'automatic') nodes.push({role:'Intake Desk', name:'Automatic routing', state:''});
		else nodes.push({role:'Admin', name:history[0]?.signedBy ?? '', state:history.length ? '' : 'Current'});
		for (const [i,event] of history.entries()) {
			const last = i === history.length - 1;
			nodes.push({role:event.recipient, name:event.recipientName ?? '', state:last && !event.returned ? (event.reviewed ? 'Signed' : 'Current') : ''});
			if (event.returned) nodes.push({role:'Admin',name:history[i + 1]?.signedBy ?? '',state:last ? 'Current' : ''});
		}
		const followup = data.record?.imageFollowup;
		if (followup) nodes.push({role:'Nurse',name:followup.recipientName,state:followup.resolvedAt ? 'Completed' : 'Current'});
		if (!history.length) nodes.push({role:'Nurse',name:'',state:'Planned'},{role:'Doctor',name:'',state:'Planned'});
		else if (data.record?.flow === 'admin-nurse-doctor' && history.at(-1)?.recipient === 'Nurse') nodes.push({role:'Doctor',name:'',state:'Planned'});
		return nodes;
	});
	const encounters = $derived(data.recordedEncounters.toSorted((a,b) => {
		const date = (id:string) => data.chart.documents.find(d => d.visitId === id)?.date ?? '';
		return date(a.visitId).localeCompare(date(b.visitId));
	}));
	const visitIds = $derived([...new Set(encounters.map(item => item.visitId))]);
	const transferSource = $derived(data.chart.documents.find(doc=>doc.id === 'ED-104')?.text.split(/\r?\n/) ?? []);
	const filedLine = $derived(transferSource.findIndex(line=>line.includes(' | Destination: ')));
	const filedDestination = $derived(filedLine < 0 ? '' : transferSource[filedLine].split(' | Destination: ')[1]);
	const editable = $derived(admin && !!data.record);
	const plans = $derived(data.record?.carePlans ?? []);
	const currentPlan = $derived(plans.findLast(plan => plan.visitId === data.document.id));
	const currentDestination = $derived(currentPlan ? [currentPlan.receivingFacility, currentPlan.receivingDepartment].filter(Boolean).join(' · ') || 'Unassigned' : filedDestination);
	const notes = $derived(data.record?.operationalNotes ?? []);
	function destination(facility: string, department: string) {
		if (!facility) return department ? 'Department · ' + department : '';
		const internal = facility.trim().toLowerCase() === data.chart.patient.hospital.toLowerCase();
		return (internal ? 'Within hospital' : 'External transfer') + (department ? ' · ' + department : '');
	}
	const selectedPlan = $derived(plans.findLast(plan => plan.visitId === selected));
	const latestNote = $derived(notes.findLast(note => note.visitId === noteVisit));
</script>

<section class="paper-card path-card" aria-label="Patient path">
	<header><h2>Patient path</h2></header>
	<ol class="team-route" aria-label="Handoff sequence">{#each route as stage, index (index)}
		<li aria-current={stage.state === 'Current' ? 'step' : undefined}><span><strong>{stage.role}</strong>{#if stage.name}<span>{stage.name}</span>{/if}{#if stage.state}<small>{stage.state}</small>{/if}</span></li>
	{/each}</ol>
	{#if currentDestination}<p class="destination-summary"><span>{currentPlan ? 'Planned destination' : 'Filed destination'}</span><strong>{currentDestination}</strong></p>{/if}
	<details class="visit-coordination">
		<summary>{editable ? 'Visit history and plan editor' : 'Visit history and plans'}</summary>
	<ol class="path-rail">
		{#each visitIds as visitId (visitId)}
			{@const plan = plans.findLast(item => item.visitId === visitId)}
			{@const facts = encounters.filter(item => item.visitId === visitId)}
			<li><div class="recorded-stop"><p class="kicker">{visitId} · Recorded</p><strong>{facts[0].facility}</strong>
				{#each facts as encounter (encounter.evidence.documentId)}<div class="encounter-fact"><span>{encounter.clinician ? encounter.clinician + ' · ' : ''}{encounter.description}</span><ChartCitation doc={encounter.evidence.documentId} line={encounter.evidence.line} label={encounter.evidence.documentId === 'ED-104' ? 'Transfer author' : encounter.clinician ? 'Report signer' : 'Prior visit record'} /></div>{/each}
			</div><div class="branch-edge" aria-hidden="true"></div>
			<div><button class="planned-stop" type="button" disabled={!editable} aria-expanded={selected === visitId} aria-label={'Edit planned destination for ' + visitId} onclick={() => selected = selected === visitId ? '' : visitId}>
				<small>{plan ? 'Staff plan' : visitId === 'ED-104' && filedDestination ? 'Filed destination' : 'Planned destination'}</small>
				<strong>{plan?.receivingFacility || (visitId === 'ED-104' && !plan ? filedDestination : '') || 'Unassigned'}</strong>
				<span>{plan?.doctorName || 'Doctor unassigned'}</span>{#if plan}<span>{destination(plan.receivingFacility,plan.receivingDepartment ?? '')}</span>
				{:else if visitId === 'ED-104' && filedDestination}<span>External transfer</span>{/if}
				{#if editable}<small class="edit-hint">Edit plan</small>{/if}
			</button>{#if !plan && visitId === 'ED-104' && filedLine >= 0}<ChartCitation line={filedLine + 1} label="Filed destination source"/>{/if}</div></li>
		{/each}
	</ol>
	{#if admin && !data.record}<p class="path-help">Prepare the brief to edit a destination or coordination note.</p>{/if}
	{#if selected && editable}
		{#key selected}
			<form method="POST" action="?/saveCarePlan" use:enhance class="path-editor">
				<input type="hidden" name="version" value={data.version} /><input type="hidden" name="visitId" value={selected} />
				<h3>Edit planned destination · {selected}</h3>
				<label for="plan-doctor">Next doctor</label><select id="plan-doctor" name="doctorId" value={selectedPlan?.doctorId ?? ''}><option value="">Unassigned</option>{#each data.doctors as doctor (doctor.id)}<option value={doctor.id}>{doctor.name}</option>{/each}</select>
				<label for="plan-facility">Receiving facility</label><input id="plan-facility" name="receivingFacility" maxlength="120" list="known-hospitals" value={selectedPlan?.receivingFacility ?? (selected === 'ED-104' ? filedDestination : '')} />
				<datalist id="known-hospitals"><option value={data.chart.patient.hospital}></option></datalist>
				<label for="plan-department">Receiving department</label><input id="plan-department" name="receivingDepartment" maxlength="120" value={selectedPlan?.receivingDepartment ?? ''} />
				<label for="plan-priority">Staff-assigned coordination priority</label><select id="plan-priority" name="priority" value={selectedPlan?.priority ?? 'unspecified'}><option value="unspecified">Unspecified</option><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select>
				<label for="plan-impact">Coordination impact</label><textarea id="plan-impact" name="impact" maxlength="200" rows="2" value={selectedPlan?.impact ?? ''}></textarea>
				<div class="buttons"><button type="submit" class="button">Save destination</button><button type="button" class="text-button" onclick={() => selected = ''}>Cancel</button></div>
			</form>
		{/key}
	{/if}
	</details>
	<details class="note-editor"><summary>Operational notes{notes.length ? ' (' + notes.length + ')' : ''}</summary>
		<label for="note-visit">Visit</label><select id="note-visit" bind:value={noteVisit}>{#each [...new Set(encounters.map(item => item.visitId))] as visitId (visitId)}<option value={visitId}>{visitId}</option>{/each}</select>
		{#if editable}
			{#key noteVisit}<form method="POST" action="?/saveNote" use:enhance>
				<input type="hidden" name="version" value={data.version} /><input type="hidden" name="visitId" value={noteVisit}/>
				<label for="coord-note">Coordination note</label><textarea id="coord-note" name="noteText" rows="3" maxlength="1000" required value={latestNote?.text ?? ''}></textarea>
				<button class="button secondary" type="submit">Save note</button></form>{/key}
		{:else}<p>{latestNote?.text ?? 'No operational note for this visit.'}</p>{/if}
		{#if latestNote}<p class="small">Last saved by {latestNote.savedBy} · <time datetime={latestNote.savedAt}>{new Date(latestNote.savedAt).toLocaleString('en-US',{timeZone:'America/New_York'})} ET</time></p>{/if}
	</details>
</section>
