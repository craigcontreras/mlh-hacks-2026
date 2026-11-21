import { requireAccountRole } from '../../lib/server/accounts';
import { packetStore } from '../../lib/server/store';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAccountRole(locals, 'Administrative staff');
	return { receipts: packetStore().receipts() };
};
