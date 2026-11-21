import { fail, redirect } from '@sveltejs/kit';
import { authenticateDemoAccount, demoAccounts, startSession } from '../../lib/server/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.account) redirect(303, '/patients');
	const stage = { Admin: 0, Nurse: 1, Doctor: 2 };
	return { accounts: demoAccounts.toSorted((a, b) => stage[a.label] - stage[b.label]) };
};

export const actions: Actions = {
	default: async ({ cookies, request, url }) => {
		const form = await request.formData();
		const account = authenticateDemoAccount(form.get('accountId'), form.get('passcode'));
		if (!account) return fail(400, { message: 'That account and passcode do not match.' });
		startSession(cookies, account, url.protocol === 'https:');
		redirect(303, '/patients');
	}
};
