import { packetStore } from '../../lib/server/store';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ receipts: packetStore().receipts() });
