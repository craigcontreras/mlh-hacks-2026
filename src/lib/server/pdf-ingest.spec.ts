import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { chartDocuments } from './chart';
import { extractPdfText, ingestJordanPdfs, numberedPdfTranscript } from './pdf-ingest';

const hasPoppler = !spawnSync('pdftotext', ['-v']).error;

test.skipIf(!hasPoppler)('every downloadable numbered PDF reproduces its verbatim citation transcript', async () => {
	const parsed = await ingestJordanPdfs();
	expect(parsed.pdfInput).toBe('pdf-text');
	expect(parsed.documents).toEqual(chartDocuments);
	const physician = await extractPdfText(readFileSync('samples/records/ED-116-physician.pdf'));
	expect(numberedPdfTranscript(physician, 'ED-116')).toBe(readFileSync('samples/records/ED-116-physician.txt', 'utf8'));
});

test('only a missing executable permits the fingerprinted transcript fallback', async () => {
	const missing = () => Promise.reject(Object.assign(new Error('pdftotext missing'), { code: 'ENOENT' }));
	const parsed = await ingestJordanPdfs(chartDocuments, missing);
	expect(parsed.pdfInput).toBe('verified-transcripts');
	expect(parsed.documents).toEqual(chartDocuments);
	const changed = chartDocuments.map(doc => doc.id === 'ED-104-radiology' ? { ...doc, text: doc.text.replace('No acute fracture', 'Fracture') } : doc);
	await expect(ingestJordanPdfs(changed, missing)).rejects.toThrow(/Could not verify the PDF/);
	await expect(ingestJordanPdfs(chartDocuments, () => Promise.reject(new Error('PDF parse failed')))).rejects.toThrow(/Could not verify the PDF/);
	await expect(ingestJordanPdfs(chartDocuments, () => Promise.resolve('01 Different report\nED-104 · Synthetic demonstration record 1/1'))).rejects.toThrow(/differs from the numbered transcript/);
});

test('line reconstruction preserves numbering and wrapped lines and rejects incomplete or reordered records', () => {
	const footer = '\nED-104 · Synthetic demonstration record 1 / 1';
	expect(numberedPdfTranscript('01 Heading\n03\n   Line three begins\n   and wraps.' + footer, 'ED-104')).toBe('Heading\n\nLine three begins and wraps.\n');
	expect(() => numberedPdfTranscript('01 Section\n01 Swapped' + footer, 'ED-104')).toThrow(/out-of-order/);
	expect(() => numberedPdfTranscript('01 Section', 'ED-104')).toThrow(/Incomplete/);
});
