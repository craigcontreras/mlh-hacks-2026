import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { clinicalDocument, summarizeDocument } from '../../lib/server/clinical-summary';
import { clinicalStore } from '../../lib/server/clinical-store';
import { ProviderError } from '../../lib/server/codex';
import { ReviewError } from '../../lib/server/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const store = clinicalStore();
	const record = store.get();
	return {
		document: { ...clinicalDocument, text: record?.sourceText ?? clinicalDocument.text, sourceUrl: '/handoffs/source' },
		record, version: record?.version ?? store.version()
	};
};

function action(command: 'summarize' | 'approve' | 'reset') {
	return async ({ request }: RequestEvent) => {
		const form = await request.formData();
		const version = form.get('version');
		if (typeof version !== 'string') return fail(400, { message: 'Reload the document before continuing.' });
		try {
			const store = clinicalStore();
			if (command === 'summarize') {
				if (store.version() !== version) throw new ReviewError('This document changed. Reload it before summarizing.');
				const record = store.get();
				if (record && record.status !== 'draft') throw new ReviewError('This handoff has already been sent.');
				const mode = form.get('mode');
				if (mode !== 'codex' && mode !== 'local') throw new ReviewError('Choose an available summary method.', 400);
				const start = performance.now();
				const summary = await summarizeDocument(mode);
				store.saveSummary(version, summary, Math.round(performance.now() - start), clinicalDocument.text);
			} else if (command === 'approve') {
				const reviewer = form.get('reviewer');
				const task = form.get('taskId');
				if ((reviewer !== 'Administrative staff' && reviewer !== 'Doctor') || typeof task !== 'string') {
					throw new ReviewError('Select the reviewing role and a documented action.', 400);
				}
				store.approve(version, reviewer, task);
			} else {
				store.reset(version);
			}
		} catch (error) {
			if (error instanceof ReviewError) return fail(error.status, { message: error.message });
			if (error instanceof ProviderError) return fail(503, { message: error.message });
			return fail(503, { message: 'The document could not be processed. Reload the last saved version and retry.' });
		}
		redirect(303, '/handoffs');
	};
}

export const actions: Actions = { summarize: action('summarize'), approve: action('approve'), reset: action('reset') };
