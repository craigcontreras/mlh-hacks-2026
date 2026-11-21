import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { ReviewError } from './store';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface FiledAttachment {
	id: string;
	name: string;
	visitId: string;
	filedAt: string;
	filedBy: string;
}

export async function readChartFile(file: File) {
	const name = file.name.trim();
	if (!name || name.length > 180 || /[/\\\p{Cc}]/u.test(name) || !file.size || file.size > MAX_UPLOAD_BYTES) {
		throw new ReviewError('Choose a nonempty file with a valid name, up to 10 MB.', 400);
	}
	const bytes = Buffer.from(await file.arrayBuffer());
	const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
	let mime: string;
	if (extension === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
	else if (extension === 'png' && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) mime = 'image/png';
	else if (['jpg','jpeg'].includes(extension) && bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) mime = 'image/jpeg';
	else if (extension === 'txt' && isUtf8(bytes) && !bytes.includes(0)) mime = 'text/plain; charset=utf-8';
	else throw new ReviewError('Choose a PDF, PNG, JPEG or UTF-8 text file matching its extension.', 400);
	return { id: createHash('sha256').update(bytes).digest('hex'), bytes, name, mime };
}
