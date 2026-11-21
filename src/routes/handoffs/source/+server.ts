import { requireAccount } from '../../../lib/server/accounts';
import { clinicalDocument } from '../../../lib/server/chart';
import { clinicalStore } from '../../../lib/server/clinical-store';
import { sampleResponse, textResponse } from '../../../lib/server/sample-assets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, url }) => {
	requireAccount(locals);
	const format = url.searchParams.get('format');
	if (format === 'pdf') return sampleResponse('ED-104-transfer-note.pdf', true, clinicalStore().get());
	if (format === 'image') return sampleResponse('ED-104-ankle.png', true);
	const text = clinicalStore().get()?.sourceText ?? clinicalDocument.text;
	return textResponse(text, 'ED-104-transfer-note.txt');
};
