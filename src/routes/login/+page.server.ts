import { fail, redirect } from '@sveltejs/kit';
import { accountHome, authenticateDemoAccount, demoAccounts, startSession } from '../../lib/server/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.account) redirect(303, accountHome(locals.account));
	return { accounts: demoAccounts };
};

export const actions: Actions = {
	default: async ({ cookies, request, url }) => {
		const form = await request.formData();
		const account = authenticateDemoAccount(form.get('accountId'), form.get('passcode'));
		if (!account) return fail(400, { message: 'That account and passcode do not match.' });
		startSession(cookies, account, url.protocol === 'https:');
		redirect(303, accountHome(account));
	}
};
