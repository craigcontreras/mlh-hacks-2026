import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requireAccountRole } from '../../lib/server/accounts';
import { clinicalDocument } from '../../lib/server/chart';
import { chartSnapshot, clinicalStore, documentedEncounters, isAssignedTo } from '../../lib/server/clinical-store';
import { ReviewError } from '../../lib/server/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const account = requireAccountRole(locals, 'Doctor', 'Nurse');
	const caseId = url.searchParams.get('case');
	if (caseId !== null && caseId !== clinicalDocument.id) error(404, 'This inbox case is unavailable.');
	const current = clinicalStore().get();
	const active = current?.history.at(-1);
	const record = isAssignedTo(active, account) && !active?.returned ? current : null;
	const chart = chartSnapshot(record);
	return {
		role: account.role, caseId, record, chart, recordedEncounters: documentedEncounters(chart.documents),
		deliveries: current?.history.filter((item) => isAssignedTo(item, account)) ?? [],
		document: record
			? { ...clinicalDocument, text: record.sourceText, sourceUrl: '/handoffs/source' }
			: null
	};
};

type Command = 'acknowledge' | 'forward' | 'recordImageStatus' | 'signReview' | 'returnToAdmin';

function action(command: Command) {
	return async ({ locals, request, url }: RequestEvent) => {
		const account = command === 'recordImageStatus' ? requireAccountRole(locals, 'Nurse')
			: command === 'signReview' || command === 'returnToAdmin' ? requireAccountRole(locals, 'Doctor')
				: requireAccountRole(locals, 'Doctor', 'Nurse');
		const form = await request.formData();
		const version = form.get('version');
		if (typeof version !== 'string') return fail(400, { message: 'Open your inbox and try again.' });
		try {
			const store = clinicalStore();
			if (command === 'acknowledge') {
				store.acknowledge(version, account);
			} else if (command === 'forward') {
				const task = form.get('taskId');
				if (typeof task !== 'string') throw new ReviewError('Choose a documented action to forward.', 400);
				store.forward(version, account, task);
			} else if (command === 'recordImageStatus') {
				const imageStatus = form.get('imageStatus');
				if (typeof imageStatus !== 'string') throw new ReviewError('Choose a comparison image status.', 400);
				store.recordImageStatus(version, account, imageStatus);
			} else if (command === 'signReview') {
				store.signReview(version, account);
			} else {
				const reason = form.get('reason');
				if (typeof reason !== 'string') throw new ReviewError('Explain why you are returning the assignment.', 400);
				store.returnToAdmin(version, account, reason);
			}
		} catch (error) {
			if (error instanceof ReviewError) return fail(error.status, { message: error.message });
			return fail(503, { message: 'Could not record this action. Reload the handoff and retry.' });
		}
		const caseId = form.get('caseId') ?? url.searchParams.get('case');
		redirect(303, caseId === clinicalDocument.id ? '/inbox?case=' + clinicalDocument.id : '/inbox');
	};
}

export const actions: Actions = {
	acknowledge: action('acknowledge'), forward: action('forward'), recordImageStatus: action('recordImageStatus'),
	signReview: action('signReview'), returnToAdmin: action('returnToAdmin')
};
