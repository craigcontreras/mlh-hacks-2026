import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requireAccountRole } from '../../lib/server/accounts';
import { clinicalDocument } from '../../lib/server/chart';
import { chartSnapshot, clinicalStore } from '../../lib/server/clinical-store';
import { ReviewError } from '../../lib/server/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const { role } = requireAccountRole(locals, 'Doctor', 'Nurse');
	const current = clinicalStore().get();
	const record = current?.history.at(-1)?.recipient === role ? current : null;
	return {
		role, record, chart: chartSnapshot(record),
		deliveries: current?.history.filter(item => item.recipient === role) ?? [],
		document: record
			? { ...clinicalDocument, text: record.sourceText, sourceUrl: '/handoffs/source' }
			: null
	};
};

function action(command: 'acknowledge' | 'forward') {
	return async ({ locals, request }: RequestEvent) => {
		const account = requireAccountRole(locals, 'Doctor', 'Nurse');
		const form = await request.formData();
		const version = form.get('version');
		if (typeof version !== 'string') return fail(400, { message: 'Open your inbox and try again.' });
		try {
			const store = clinicalStore();
			if (command === 'acknowledge') {
				store.acknowledge(version, account);
			} else {
				const task = form.get('taskId');
				if (typeof task !== 'string') throw new ReviewError('Choose a documented action to forward.', 400);
				store.forward(version, account, task);
			}
		} catch (error) {
			if (error instanceof ReviewError) return fail(error.status, { message: error.message });
			return fail(503, { message: 'Could not record this action. Reload the handoff and retry.' });
		}
		redirect(303, '/inbox');
	};
}

export const actions: Actions = { acknowledge: action('acknowledge'), forward: action('forward') };
