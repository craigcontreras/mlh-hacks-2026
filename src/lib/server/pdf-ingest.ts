import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import transferPdf from '../../../samples/records/ED-104-transfer-note.pdf?inline';
import radiologyPdf from '../../../samples/records/ED-104-radiology.pdf?inline';
import { chartDocuments, type ChartDocument } from './chart';
import { ProviderError } from './codex';

// These fingerprints pair the checked PDF bytes with their verified numbered transcript for installations without Poppler.
const sources = [
	{ documentId: 'ED-104', pdf: transferPdf, fingerprint: 'ed1cc8e0fc8e7db9af592cc4a0580144a5414e81664611470aef2400d06cd8d7' },
	{ documentId: 'ED-104-radiology', pdf: radiologyPdf, fingerprint: '7847fcb4eeb27ed72ef80dd04d39917f77398c4df5efaf17220ec50518072af8' }
];

export function extractPdfText(bytes: Buffer): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = execFile('pdftotext', ['-layout', '-nopgbrk', '-enc', 'UTF-8', '-', '-'],
			{ timeout: 5000, maxBuffer: 128 * 1024, encoding: 'utf8' },
			(err, stdout) => err instanceof Error ? reject(err) : resolve(stdout));
		child.stdin?.on('error', () => {});
		child.stdin?.end(bytes);
	});
}

export function numberedPdfTranscript(extractedText: string, visitId: string) {
	const lines: string[] = [];
	let footer = false;
	for (const row of extractedText.split(/\r?\n/)) {
		const content = row.trim();
		if (!content) continue;
		if (!footer && content.replace(/\s/g, '') === visitId + '·Syntheticdemonstrationrecord1/1') {
			footer = true;
			continue;
		}
		if (footer) throw new Error('Unexpected text after PDF footer');
		const numbered = /^(\d{2,3})(?:\s+(.+))?$/.exec(content);
		if (numbered) {
			const position = Number(numbered[1]);
			if (position <= lines.length) throw new Error('Duplicate or out-of-order source line');
			while (lines.length < position - 1) lines.push('');
			lines.push(numbered[2]?.trim() ?? '');
		} else if (lines.length) {
			lines[lines.length - 1] = [lines.at(-1), content].filter(Boolean).join(' ');
		} else throw new Error('Unnumbered PDF preamble');
	}
	if (!footer || !lines.length) throw new Error('Incomplete numbered PDF');
	return lines.join('\n') + '\n';
}

export type PdfInputMethod = 'pdf-text' | 'verified-transcripts';
export async function ingestJordanPdfs(documents: ChartDocument[] = chartDocuments, extract = extractPdfText) {
	const method: PdfInputMethod[] = [];
	const parsed = await Promise.all(sources.map(async source => {
		const document = documents.find(doc => doc.id === source.documentId);
		if (!document) throw new ProviderError('The transfer is missing a required source document. Reopen the chart.');
		const bytes = Buffer.from(source.pdf.slice(source.pdf.indexOf(',') + 1), 'base64');
		let text: string;
		try {
			text = numberedPdfTranscript(await extract(bytes), document.visitId);
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
				const signature = createHash('sha256').update(bytes).update('\0').update(document.text).digest('hex');
				if (signature === source.fingerprint) {
					method.push('verified-transcripts');
					return document;
				}
			}
			throw new ProviderError('Could not verify the PDF for ' + document.title + '. Check the bundled file and its numbered transcript before sending.');
		}
		if (text !== document.text) throw new ProviderError('The PDF for ' + document.title + ' differs from the numbered transcript. Resolve the source mismatch before sending.');
		method.push('pdf-text');
		return { ...document, text };
	}));
	const pdfInput: PdfInputMethod = method.includes('verified-transcripts') ? 'verified-transcripts' : 'pdf-text';
	return { pdfInput, documents: documents.map(doc => parsed.find(item => item.id === doc.id) ?? doc) };
}
