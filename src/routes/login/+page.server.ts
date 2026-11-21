import { fail, redirect } from '@sveltejs/kit';
import { authenticateDemoAccount, demoAccounts, startSession } from '../../lib/server/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.account) redirect(303, url.searchParams.get('guide') === 'jordan' ? '/patients?guide=jordan' : '/patients');
	const stage = { Admin: 0, Nurse: 1, Doctor: 2 };
	return { accounts: demoAccounts.toSorted((a, b) => stage[a.label] - stage[b.label]) };
};

export const actions: Actions = {
	default: async ({ cookies, request, url }) => {
		const form = await request.formData();
		const account = authenticateDemoAccount(form.get('accountId'), form.get('passcode'));
		if (!account) return fail(400, { message: 'That account and passcode do not match.' });
		startSession(cookies, account, url.protocol === 'https:');
		if (cookies.get('jordan_guide') === '1') redirect(303, account.id === 'admin' ? '/handoffs' : '/inbox');
		redirect(303, '/patients');
	}
};
