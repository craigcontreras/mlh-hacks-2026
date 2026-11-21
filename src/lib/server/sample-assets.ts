import { error } from '@sveltejs/kit';
import { chartDocuments, clinicalDocument } from './chart';
import { chartSnapshot, type ClinicalState } from './clinical-store';
const binaryAssets = import.meta.glob<string>('../../../samples/records/*.{pdf,png}', {
	query: '?inline', import: 'default'
});
const textAssets = import.meta.glob<string>('../../../samples/records/*.txt', {
	query: '?raw', import: 'default', eager: true
});

export async function sampleResponse(filename: string, attachment = false, record?: ClinicalState | null): Promise<Response> {
	if (record && filename.endsWith('.pdf')) {
		const canonical = chartDocuments.find(doc => doc.sourceUrl === '/samples/' + filename.replace(/\.pdf$/, '.txt'));
		if (canonical) {
			const saved = chartSnapshot(record).documents.find(doc => doc.id === canonical.id);
			if (saved?.text !== canonical.text || (canonical.id === clinicalDocument.id && record.sourceText !== canonical.text)) {
				error(409, 'This PDF does not match the saved chart. Read the signed source text instead.');
			}
		}
	}
	const text = textAssets['../../../samples/records/' + filename];
	if (text !== undefined) return textResponse(text, filename, attachment);

	const binary = binaryAssets['../../../samples/records/' + filename];
	if (!binary) error(404, 'This document is unavailable.');
	const dataUrl = await binary();
	const type = filename.endsWith('.pdf') ? 'application/pdf' : 'image/png';
	const bytes = Uint8Array.from(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
	return new Response(bytes, { headers: sampleHeaders(filename, type, attachment) });
}

function sampleHeaders(filename: string, type: string, attachment: boolean) {
	return {
		'Content-Type': type,
		'Content-Disposition': `${attachment ? 'attachment' : 'inline'}; filename="${filename}"`,
		'Cache-Control': 'private, no-store'
	};
}

export function textResponse(text: string, filename: string, attachment = true) {
	return new Response(text, { headers: sampleHeaders(filename, 'text/plain; charset=utf-8', attachment) });
}
