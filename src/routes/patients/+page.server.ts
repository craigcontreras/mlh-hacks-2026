import { patientFileInventory } from '../../lib/server/file-inventory';
import { randomUUID } from 'node:crypto';
import { documentOverviews, summarizePatientChart } from '../../lib/server/chart-brief';
import { buildEvidenceMap } from '../../lib/patient-map';
import { chartPatient } from '../../lib/server/chart';
import { error } from '@sveltejs/kit';
import { requireAccount } from '../../lib/server/accounts';
import { packetStore } from '../../lib/server/store';
import type { PageServerLoad } from './$types';

export { actions } from './updates.server';

export const load: PageServerLoad = ({ locals, url }) => {
	const account = requireAccount(locals);
	const store = packetStore();
	const patientId = url.searchParams.get('patient');
	const snapshot = store.clinical.snapshot();
	const { record, practice } = snapshot;
	const data = store.patients.view(account, record, url.searchParams.get('q')?.trim() ?? '', url.searchParams.get('scope') === 'mine', patientId, practice);
	if (patientId && !data.patient) error(404, 'This patient record is unavailable.');
	const chartBrief = data.patient ? summarizePatientChart(data) : null;
	const imagingRequest = data.patient?.id === chartPatient.id ? snapshot.imagingNotice : null;
	const evidenceMap = chartBrief ? buildEvidenceMap(chartBrief.items, data, data.hasTransfer ? record : null, imagingRequest) : [];
	const fileInventory = data.patient ? patientFileInventory(data.patient, data.documents, record, data.uploads.length, imagingRequest) : null;
	return { ...data, imagingRequest, deliveryVersion: account.role === 'Administrative staff' ? snapshot.version : null, fileInventory, overviews: data.patient ? documentOverviews(data.patient, data.documents) : {}, chartBrief, evidenceMap, updateRequestId: account.role === 'Administrative staff' && data.patient ? randomUUID() : null };
};
