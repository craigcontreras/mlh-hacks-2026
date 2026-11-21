<script lang="ts">
	import { resolve } from '$app/paths';
	import { refreshAll } from '$app/navigation';
	import DemoStep from '#lib/ui/DemoStep.svelte';
	import type { PageProps } from './$types';
	import '#lib/ui/flow.css';

	let { data }: PageProps = $props();
	const groups = $derived([
		{ label: 'Assigned to you', rows: data.rows.filter(row => row.active) },
		{ label: 'Past assignments', rows: data.rows.filter(row => !row.active) }
	]);
</script>

<svelte:window onfocus={() => { void refreshAll(); }} />
<svelte:head><title>{data.role} inbox · Intake Desk</title></svelte:head>
<header class="pagehead flow-title"><div><p class="kicker">{data.account?.name} · {data.role}</p><h1>My inbox</h1></div></header>
{#each groups as group (group.label)}
	{#if group.rows.length}<section class="paper-card inbox-list"><header><h2>{group.label}</h2><span>{group.rows.length} {group.rows.length === 1 ? 'case' : 'cases'}</span></header>
		{#each group.rows as patient (patient.patientId)}
			<a href={resolve('/inbox/[patientId]', {patientId: patient.patientId})} class="case-row">
				<span class="patient-mark" aria-hidden="true">{patient.name.split(' ').map(part => part[0]).join('')}</span>
				<span><small>{patient.visitId}</small><strong>{#if patient.patientId === 'J-104' && patient.active && data.account}
					<DemoStep n={data.account.id === 'nurse' ? 2 : data.account.id === 'doctor' ? 5 : 13} owner={data.account.id}/>
				{/if}{patient.name}</strong><span>{patient.text}</span></span><span class="row-arrow" aria-hidden="true">→</span>
			</a>
		{/each}
	</section>{/if}
{/each}
{#if !data.rows.length}<section class="paper-card empty"><h2>Your inbox is clear</h2><p>Handoffs assigned to {data.account?.name} appear here.</p><a class="button secondary" href={resolve('/patients')}>Browse patient records</a></section>{/if}
