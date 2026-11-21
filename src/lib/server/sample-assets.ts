import { error } from '@sveltejs/kit';
const pdfName = 'ED-104-transfer-note.pdf';
const imageName = 'ED-104-ankle.png';
const textAssets = import.meta.glob<string>('../../../samples/records/*.txt', {
	query: '?raw', import: 'default', eager: true
});

export async function sampleResponse(filename: string, attachment = false): Promise<Response> {
	const text = textAssets['../../../samples/records/' + filename];
	if (text !== undefined) return textResponse(text, filename, attachment);

	let dataUrl: string;
	let type: string;
	if (filename === pdfName) {
		dataUrl = (await import('../../../samples/records/ED-104-transfer-note.pdf?inline')).default;
		type = 'application/pdf';
	} else if (filename === imageName) {
		dataUrl = (await import('../../../samples/records/ED-104-ankle.png?inline')).default;
		type = 'image/png';
	} else {
		error(404, 'This document is unavailable.');
	}
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
