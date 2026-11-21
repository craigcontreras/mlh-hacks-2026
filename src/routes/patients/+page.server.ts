import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { requireAccount } from '../../lib/server/accounts';
import { packetStore } from '../../lib/server/store';
import type { PageServerLoad } from './$types';

export { actions } from './updates.server';

export const load: PageServerLoad = ({ locals, url }) => {
	const account = requireAccount(locals);
	const store = packetStore();
	const patientId = url.searchParams.get('patient');
	const data = store.patients.view(account, store.clinical.get(), url.searchParams.get('q')?.trim() ?? '', url.searchParams.get('scope') === 'mine', patientId);
	if (patientId && !data.patient) error(404, 'This patient record is unavailable.');
	return { ...data, updateRequestId: account.role === 'Administrative staff' && data.patient ? randomUUID() : null };
};
