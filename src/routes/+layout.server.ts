import type { LayoutServerLoad } from './$types';
import { demoAccounts, type AccountId } from '../lib/server/accounts';
import { clinicalStore } from '../lib/server/clinical-store';

export const load: LayoutServerLoad = ({ locals, cookies, url }) => {
	const mode = url.searchParams.get('guide');
	if (mode === 'jordan') cookies.set('jordan_guide', '1', { path: '/', sameSite: 'lax', secure: url.protocol === 'https:' });
	if (mode === 'off') cookies.delete('jordan_guide', { path: '/' });
	const account = locals.account;
	if (cookies.get('jordan_guide') !== '1') return { account, guide: null };

	let owner: AccountId | undefined = 'nurse';
	let signedBy: string | undefined;
	if (account) {
		const { record } = clinicalStore().snapshot();
		const latest = record?.history.at(-1);
		signedBy = latest?.reviewed?.reviewedBy;
		owner = record?.flow === 'admin-nurse-doctor' && latest && !signedBy
			? latest.returned ? 'admin' : latest.recipientAccountId
			: undefined;
	}
	return { account, guide: { owner: demoAccounts.find(person => person.id === owner), signedBy } };
};
