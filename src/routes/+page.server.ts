import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requireAccount, requireAccountRole } from '../lib/server/accounts';
import { fixtures, isFixtureId, type FixtureId } from '../lib/server/fixtures';
import { parsePacket } from '../lib/server/extraction';
import { parseWithCodex, ProviderError } from '../lib/server/codex';
import { packetStore, ReviewError } from '../lib/server/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!url.search) {
		requireAccount(locals);
		redirect(307, '/patients');
	}
	requireAccountRole(locals, 'Administrative staff');
	const sample = url.searchParams.get('sample');
	const sampleId = isFixtureId(sample) ? sample : 'corrected';
	return {
		sampleId, packet: fixtures[sampleId], record: packetStore().get(sampleId),
		samples: (Object.keys(fixtures) as FixtureId[]).map(id => ({
			id, title: fixtures[id].title, packetId: fixtures[id].id
		}))
	};
};

type Command = 'extract' | 'hold' | 'resume' | 'approve' | 'reset';

function action(command: Command) {
	return async ({ locals, request }: RequestEvent) => {
		const account = requireAccountRole(locals, 'Administrative staff');
		const form = await request.formData();
		const id = form.get('sampleId');
		const version = form.get('version');
		if (!isFixtureId(id) || typeof version !== 'string') return fail(400, { message: 'Choose a bundled sample packet.' });
		try {
			const store = packetStore();
			if (command === 'extract') {
				const current = store.get(id);
				if ((current?.version ?? '') !== version || (current && current.status !== 'review')) {
					throw new ReviewError('This packet changed. Review its current status before parsing again.');
				}
				const mode = form.get('mode');
				if (mode !== 'codex' && mode !== 'local') return fail(400, { message: 'Choose an extraction method.' });
				const draft = mode === 'codex' ? await parseWithCodex(id) : parsePacket(fixtures[id]);
				store.saveDraft(id, version, draft);
			} else {
				const selected = form.get('selectedRef');
				store.change(id, version, command, account, typeof selected === 'string' && selected ? selected : null);
			}
		} catch (error) {
			if (error instanceof ReviewError) return fail(error.status, { message: error.message });
			if (error instanceof ProviderError) return fail(503, { message: error.message });
			return fail(503, { message: 'Could not save the packet. Check the local database and retry. Your last saved version is available.' });
		}
		redirect(303, '/?sample=' + id);
	};
}

export const actions: Actions = {
	extract: action('extract'), hold: action('hold'), resume: action('resume'),
	approve: action('approve'), reset: action('reset')
};
