import { error } from '@sveltejs/kit';
import { requireAccount } from '../../../../../../lib/server/accounts';
import { packetStore } from '../../../../../../lib/server/store';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params }) => {
	requireAccount(locals);
	const file = packetStore().patients.filedAttachment(params.patientId, params.visitId, params.id);
	if (!file) error(404, 'This file is unavailable in this visit.');
	return new Response(file.bytes, { headers: {
		'Content-Type': file.mime,
		'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(file.name).replaceAll("'", '%27'),
		'Content-Security-Policy': "sandbox; default-src 'none'",
		'X-Content-Type-Options': 'nosniff',
		'Cache-Control': 'private, no-store'
	} });
};
