import { fail, type Action } from '@sveltejs/kit';
import { requireAccount } from '../../lib/server/accounts';
import { prepareChartBrief } from '../../lib/server/chart-brief';
import { ProviderError } from '../../lib/server/codex';
import { packetStore } from '../../lib/server/store';

export const prepareBrief = (async ({ locals, request, url }) => {
	const account = requireAccount(locals);
	const patientId = url.searchParams.get('patient') ?? '';
	const mode = (await request.formData()).get('mode');
	if (!patientId || (mode !== 'local' && mode !== 'codex')) {
		return fail(400, { patientId, briefError: 'Open a patient chart and select an available brief method.' });
	}
	try {
		const store = packetStore();
		const { record, practice } = store.clinical.snapshot();
		const view = store.patients.view(account, record, '', false, patientId, practice);
		if (!view.patient) return fail(404, { patientId, briefError: 'This patient chart is unavailable.' });
		return { patientId, chartBrief: await prepareChartBrief(view, mode) };
	} catch (error) {
		return fail(503, { patientId, briefError: error instanceof ProviderError ? error.message : 'The brief could not be prepared. Reopen the chart and try again.' });
	}
}) satisfies Action;
