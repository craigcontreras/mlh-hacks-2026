import { error, redirect } from '@sveltejs/kit';
import { requireAccountRole } from '../../lib/server/accounts';
import { clinicalDocument } from '../../lib/server/chart';
import { inboxFor } from '../../lib/server/patient-inbox';
import type { PageServerLoad } from './$types';

export { actions } from './[patientId]/+page.server';

export const load: PageServerLoad = ({ locals, url }) => {
	const account = requireAccountRole(locals, 'Doctor', 'Nurse');
	const legacyCase = url.searchParams.get('case');
	if (legacyCase !== null) {
		if (legacyCase !== clinicalDocument.id) error(404, 'This inbox case is unavailable.');
		redirect(307, '/inbox/' + clinicalDocument.patientId);
	}
	return { role: account.role, rows: inboxFor(account).rows };
};
