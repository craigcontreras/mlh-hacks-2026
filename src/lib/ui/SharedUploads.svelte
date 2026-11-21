<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { FiledAttachment } from '../server/chart-attachments';
	import type { ChartDocument } from '../server/chart';

	let { patientId, documents, uploads, form }: {
		patientId: string; documents: ChartDocument[]; uploads: FiledAttachment[];
		form?: { patientId?: string; fileError?: string; filed?: number; uploadVisit?: string } | null;
	} = $props();
	let saving = $state(false);
	const result = $derived(form?.patientId === patientId ? form : null);
	const visits = $derived([...new Map(documents.map(doc => [doc.visitId, doc.date]))].sort((a,b) => b[1].localeCompare(a[1])));
	const displayDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });
</script>

<section class="paper-card uploads" aria-label="Files added by staff">
	{#if uploads.length}
		<h2>Files added by staff</h2>
		<ul>{#each uploads as file (file.visitId + file.id)}
			<li>
				<a href={resolve('/patients/[patientId]/files/[visitId]/[id]', { patientId, visitId: file.visitId, id: file.id })} target="_blank" rel="noopener">{file.name}</a>
				<small>{file.visitId} · Filed by {file.filedBy} · <time datetime={file.filedAt}>{displayDate.format(new Date(file.filedAt))}</time></small>
			</li>
		{/each}</ul>
	{/if}
	{#if result?.filed !== undefined}<p role="status">{result.filed === 0 ? 'These files were already filed for this visit.' : result.filed === 1 ? 'One file is now available to the care team.' : result.filed + ' files are now available to the care team.'}</p>{/if}
	<details open={Boolean(result?.fileError)}>
		<summary>Add files to this chart</summary>
		<form method="POST" enctype="multipart/form-data" action={'?/fileAttachments&' + new URLSearchParams({patient: patientId, tab: 'documents'}).toString()}
			use:enhance={({ cancel }) => {
				if (saving) { cancel(); return; }
				saving = true;
				return async ({ update }) => { try { await update(); } finally { saving = false; } };
			}}>
			<label for="shared-file-visit">Visit</label>
			<select id="shared-file-visit" name="visitId" required>
					{#each visits as [id, date] (id)}<option value={id}>{date} · {id}</option>{/each}
			</select>
			<label for="shared-file-upload">Demo files</label>
			<input id="shared-file-upload" type="file" name="files" accept=".pdf,.png,.jpg,.jpeg,.txt" multiple required aria-describedby="file-help"/>
			<small id="file-help">Use synthetic PDFs, images or text files. Up to 10 MB total.</small>
			{#if result?.fileError}<p class="notice error" role="alert">{result.fileError}</p>{/if}
			<button class="button" type="submit" disabled={saving}>{saving ? 'Filing…' : 'File for care team'}</button>
		</form>
	</details>
</section>

<style>
	.uploads {margin-block:14px;padding:16px 20px;min-width:0}
	h2 {font-size:18px;margin-bottom:8px}
	ul {list-style:none;margin:0 0 12px;padding:0}
	li {padding:8px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}
	small {display:block;color:var(--muted);font-size:13px}
	summary {width:fit-content;cursor:pointer;font-weight:650}
	form {display:grid;gap:8px;margin-top:12px}
	label {display:grid;gap:3px;font-size:14px;font-weight:600}
	select,input {max-width:100%;font:inherit;width:fit-content}
	select {border:1px solid var(--line);border-radius:5px;background:white;padding:6px 10px}
	button {justify-self:start}
	[role=status] {margin-bottom:10px}
</style>
