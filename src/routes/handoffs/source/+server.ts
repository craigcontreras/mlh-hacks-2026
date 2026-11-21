import { clinicalDocument } from '../../../lib/server/clinical-summary';
import { clinicalStore } from '../../../lib/server/clinical-store';

export function GET() {
	const text = clinicalStore().get()?.sourceText ?? clinicalDocument.text;
	return new Response(text, { headers: {
		'Content-Type': 'text/plain; charset=utf-8',
		'Content-Disposition': 'attachment; filename="ED-104-transfer-note.txt"',
		'Cache-Control': 'no-store'
	} });
}
