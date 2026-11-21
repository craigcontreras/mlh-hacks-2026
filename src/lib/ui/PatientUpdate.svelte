<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import type { ChartDocument } from '../server/chart';

	let { patientId, documents, requestId, form }: {
		patientId: string;
		documents: ChartDocument[];
		requestId: string;
		form?: { patientId?: string; saved?: boolean; updateError?: string; visitId?: string; updateText?: string; requestId?: string } | null;
	} = $props();
	let busy = $state(false);
	const result = $derived(form?.patientId === patientId ? form : null);
	const visits = $derived([...new Map(documents.map(doc => [doc.visitId, doc.date]))].sort((a,b) => b[1].localeCompare(a[1])));
	const action = $derived.by(() => {
		const search = page.url.searchParams.get('q');
		const query = new URLSearchParams({
			patient: patientId,
			...(search && { q: search }),
			...(page.url.searchParams.get('scope') === 'mine' && { scope: 'mine' })
		});
		return '?/addUpdate&' + query.toString();
	});
	const submit: SubmitFunction = ({cancel}) => {
		if (busy) { cancel(); return; }
		busy = true;
		return async ({ update }) => {
			try { await update(); } finally { busy = false; }
		};
	};
</script>

{#if result?.saved}<p role="status" class="saved">Update added to the patient log.</p>{/if}
<details class="editor" open={Boolean(result?.updateError)}>
	<summary>Add coordination update</summary>
	<form method="POST" {action} use:enhance={submit} aria-busy={busy}>
		{#if result?.updateError}<p class="notice error" role="alert">{result.updateError}</p>{/if}
		<input type="hidden" name="requestId" value={result?.requestId ?? requestId} />
		<label for="update-visit">Visit</label>
		<select id="update-visit" name="visitId" value={result?.visitId ?? visits[0]?.[0]} required>
			{#each visits as [id, date] (id)}<option value={id}>{date} · {id}</option>{/each}
		</select>
		<label for="patient-update">Coordination update</label>
		<textarea id="patient-update" name="updateText" rows="3" maxlength="1000" required value={result?.updateText ?? ''}></textarea>
		<button class="button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save update'}</button>
	</form>
</details>

<style>
	.editor {background:var(--paper);border:1px solid var(--line);border-radius:8px}
	summary {padding:12px 17px;cursor:pointer;font-weight:650;color:var(--forest)}
	form {padding:0 17px 16px;display:grid;gap:8px}
	label {font-size:14px;font-weight:650}
	select, textarea {font:inherit;color:var(--ink);background:white;border:1px solid #b6b6b6;border-radius:5px;padding:8px;max-width:100%}
	button {justify-self:start}
	.saved {color:var(--forest);font-size:14px}
</style>
