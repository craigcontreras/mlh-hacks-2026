import { documentOverviews, summarizeChartDocuments } from '../../lib/server/chart-brief';
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { doctorAccounts, requireAccount, requireAccountRole } from '../../lib/server/accounts';
import { clinicalDocument } from '../../lib/server/chart';
import { prepareClinicalChart } from '../../lib/server/clinical-summary';
import { chartSnapshot, clinicalStore, documentedEncounters, isAssignedTo } from '../../lib/server/clinical-store';
import { ingestJordanPdfs } from '../../lib/server/pdf-ingest';
import { ProviderError } from '../../lib/server/codex';
import { ReviewError } from '../../lib/server/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const account = requireAccount(locals);
	const { record, chart, version, practice } = clinicalStore().snapshot();
	return {
		document: { ...clinicalDocument, text: record?.sourceText ?? clinicalDocument.text, sourceUrl: '/handoffs/source' },
		overviews: documentOverviews(chart.patient, chart.documents),
		packetPoints: record ? summarizeChartDocuments(chart.patient, chart.documents).items : [],
		record, chart, doctors: doctorAccounts, recordedEncounters: documentedEncounters(chart.documents),
		ownsDelivery: isAssignedTo(record?.history.at(-1), account),
		version, practiceAccession: practice?.accession ?? null
	};
};

function textField(form: FormData, name: string, fallback = '') {
	const value = form.get(name) ?? fallback;
	if (typeof value !== 'string') throw new ReviewError('Use text for operational inputs.', 400);
	return value;
}

type Command = 'summarize' | 'approve' | 'requestPriorStudy' | 'reassign' | 'saveNote' | 'saveCarePlan' | 'reset' | 'randomize';

function action(command: Command) {
	return async ({ locals, request }: RequestEvent) => {
		const account = requireAccountRole(locals, 'Administrative staff');
		const form = await request.formData();
		const version = form.get('version');
		if (typeof version !== 'string') return fail(400, { message: 'Reload the document before continuing.' });
		try {
			const store = clinicalStore();
			if (command === 'summarize') {
				const { record, chart, version: currentVersion } = store.snapshot();
				if (currentVersion !== version) throw new ReviewError('This document changed. Reload it before summarizing.');
				if (record && record.status !== 'draft') throw new ReviewError('This handoff has already been sent.');
				const mode = form.get('mode');
				if (mode !== 'codex' && mode !== 'local') throw new ReviewError('Choose an available summary method.', 400);
				const start = performance.now();
				const { summary, documents } = await prepareClinicalChart(mode, chart.documents);
				const transfer = documents.find(doc => doc.id === clinicalDocument.id)!;
				store.saveSummary(version, summary, Math.round(performance.now() - start), transfer.text, documents);
			} else if (command === 'approve') {
				const task = form.get('taskId');
				if (typeof task !== 'string') throw new ReviewError('Select a documented action.', 400);
				const record = store.get();
				if (record?.status === 'draft') await ingestJordanPdfs(chartSnapshot(record).documents);
				store.approve(version, account, task);
			} else if (command === 'requestPriorStudy') {
				store.requestPriorStudy(version, account);
			} else if (command === 'reassign') {
				store.reassign(version, account, textField(form, 'doctorId'));
			} else if (command === 'saveNote') {
				store.saveNote(version, account, textField(form, 'visitId'), textField(form, 'noteText'));
			} else if (command === 'saveCarePlan') {
				store.saveCarePlan(version, account, textField(form, 'visitId'), textField(form, 'doctorId'),
					textField(form, 'receivingFacility'), textField(form, 'priority', 'unspecified'),
					textField(form, 'impact'), textField(form, 'receivingDepartment'));
			} else if (command === 'randomize') {
				store.randomize(version, account);
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

export const actions: Actions = {
	summarize: action('summarize'), approve: action('approve'),
	requestPriorStudy: action('requestPriorStudy'), reassign: action('reassign'),
	saveNote: action('saveNote'), saveCarePlan: action('saveCarePlan'), reset: action('reset'), randomize: action('randomize')
};
