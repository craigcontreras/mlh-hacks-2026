import { requireAccount } from '../../../lib/server/accounts';
import { clinicalStore } from '../../../lib/server/clinical-store';
import { sampleResponse, textResponse } from '../../../lib/server/sample-assets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params }) => {
	requireAccount(locals);
	const { record, chart } = clinicalStore().snapshot();
	const document = chart.documents.find(source => source.sourceUrl === '/samples/' + params.filename);
	if (document) return textResponse(document.text, params.filename, false);
	if (record && params.filename === 'ED-104-transfer-note.txt') return textResponse(record.sourceText, params.filename, false);
	return sampleResponse(params.filename, false, record);
};
