import { requireAccount } from '../../../lib/server/accounts';
import { error } from '@sveltejs/kit';
import { chartPatient } from '../../../lib/server/chart';
import { packetStore } from '../../../lib/server/store';
import { patientFileInventory, priorImageFilename } from '../../../lib/server/file-inventory';
import { sampleResponse, textResponse } from '../../../lib/server/sample-assets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params, url }) => {
	const account = requireAccount(locals);
	const store = packetStore();
	const { record, chart, practice, imagingNotice } = store.clinical.snapshot();
	if (params.filename === priorImageFilename) {
		const view = store.patients.view(account, record, '', false, chartPatient.id, practice);
		const image = view.patient && patientFileInventory(view.patient, view.documents, record, 0, imagingNotice).priorImage;
		if (!image?.url || image.accession !== url.searchParams.get('study')) {
			error(404, 'This comparison image is unavailable in the shared chart.');
		}
	}
	const document = chart.documents.find(source => source.sourceUrl === '/samples/' + params.filename);
	if (document) return textResponse(document.text, params.filename, false);
	if (record && params.filename === 'ED-104-transfer-note.txt') return textResponse(record.sourceText, params.filename, false);
	return sampleResponse(params.filename, false, record);
};
