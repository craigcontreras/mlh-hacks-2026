import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { clinicalDocument } from '../../lib/server/clinical-summary';
import { clinicalStore } from '../../lib/server/clinical-store';
import { ReviewError } from '../../lib/server/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const role = url.searchParams.get('role') === 'Nurse' ? 'Nurse' : 'Doctor';
	const record = clinicalStore().get();
	const deliveries = record?.history.filter(item => item.recipient === role) ?? [];
	return {
		role, deliveries, record: deliveries.length ? record : null,
		document: record && deliveries.length
			? { ...clinicalDocument, text: record.sourceText, sourceUrl: '/handoffs/source' }
			: null
	};
};

function action(command: 'acknowledge' | 'forward') {
	return async ({ request, url }: RequestEvent) => {
		const form = await request.formData();
		const role = url.searchParams.get('role');
		const version = form.get('version');
		if ((role !== 'Nurse' && role !== 'Doctor') || form.get('role') !== role || typeof version !== 'string') {
			return fail(400, { message: 'Open the receiving worker’s inbox and try again.' });
		}
		try {
			const store = clinicalStore();
			if (command === 'acknowledge') {
				store.acknowledge(version, role);
			} else {
				const task = form.get('taskId');
				if (typeof task !== 'string') throw new ReviewError('Choose a documented action to forward.', 400);
				store.forward(version, role, task);
			}
		} catch (error) {
			if (error instanceof ReviewError) return fail(error.status, { message: error.message });
			return fail(503, { message: 'Could not record this action. Reload the handoff and retry.' });
		}
		redirect(303, '/inbox?role=' + role);
	};
}

export const actions: Actions = { acknowledge: action('acknowledge'), forward: action('forward') };
