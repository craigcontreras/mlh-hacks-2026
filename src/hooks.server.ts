import type { Handle } from '@sveltejs/kit/hooks';
import { sessionAccount, sessionCookie } from './lib/server/accounts';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.account = sessionAccount(event.cookies.get(sessionCookie));
	const response = await resolve(event);
	response.headers.set('Cache-Control', 'private, no-store');
	return response;
};
