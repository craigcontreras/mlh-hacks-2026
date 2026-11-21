import { requireAccount } from '../../lib/server/accounts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAccount(locals);
};
