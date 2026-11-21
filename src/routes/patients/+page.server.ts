import { error } from '@sveltejs/kit';
import { requireAccount } from '../../lib/server/accounts';
import { chartDocuments, chartPatient, type ChartDocument } from '../../lib/server/chart';
import registration from '../../../samples/records/ED-116-registration.txt?raw';
import receipt from '../../../samples/records/ED-116-visit-receipt.txt?raw';
import intake from '../../../samples/records/ED-071-intake.txt?raw';
import delivery from '../../../samples/records/ED-071-access.txt?raw';
import type { PageServerLoad } from './$types';

const casey = { id: 'C-116', name: 'Casey Rowan', hospital: chartPatient.hospital };
function archive(id: string, title: string, text: string, visitId: string, date: string): ChartDocument {
	return { id, title, text, patientId: casey.id, visitId, date, sourceUrl: `/samples/${id}.txt` };
}

const charts = [
	{ patient: chartPatient, documents: chartDocuments, hasTransfer: true },
	{ patient: casey, documents: [
		archive('ED-116-registration', 'Communication preferences', registration, 'ED-116', '2026-11-20'),
		archive('ED-116-visit-receipt', 'Visit paperwork receipt', receipt, 'ED-116', '2026-11-20'),
		archive('ED-071-intake', 'Prior visit intake', intake, 'ED-071', '2026-08-18'),
		archive('ED-071-access', 'Accessible print delivery', delivery, 'ED-071', '2026-08-18')
	], hasTransfer: false }
];

export const load: PageServerLoad = ({ locals, url }) => {
	requireAccount(locals);
	const query = url.searchParams.get('q')?.trim() ?? '';
	const search = query.toLowerCase();
	const matches = charts.filter(({ patient, documents }) =>
		[patient.name, patient.id, ...documents.map((doc) => doc.visitId)].some((s) => s.toLowerCase().includes(search))
	);
	const patientId = url.searchParams.get('patient');
	const chart = patientId ? matches.find((c) => c.patient.id === patientId) : matches[0];
	if (patientId && !chart) error(404, 'This patient is unavailable for the selected search.');
	return {
		query, matches: matches.map((c) => c.patient), patient: chart?.patient, hasTransfer: chart?.hasTransfer,
		documents: chart?.documents ?? []
	};
};
