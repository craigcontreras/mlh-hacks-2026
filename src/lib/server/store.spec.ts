import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtures } from './fixtures';
import { parsePacket } from './extraction';
import { PacketStore } from './store';

describe('SQLite clerk handoffs', () => {
	let directory: string;
	let path: string;
	let store: PacketStore;
	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), 'intake-test-'));
		path = join(directory, 'demo.sqlite');
		store = new PacketStore(path);
	});
	afterEach(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });

	it('saves one source-backed approval across retries and reopening the database', () => {
		const draft = parsePacket(fixtures.corrected);
		store.saveDraft('corrected', '', draft);
		const version = store.get('corrected')!.version;
		expect(() => store.change('corrected', version, 'approve', 'transfer:4')).toThrow();
		expect(store.receipts()).toEqual([]);
		store.change('corrected', version, 'approve', draft.correctionRef);
		const [receipt] = store.receipts();
		store.change('corrected', version, 'approve', draft.correctionRef);
		store.close();
		store = new PacketStore(path);
		expect(store.receipts()).toEqual([receipt]);
		expect(receipt.values.callback).toMatchObject({ value: '241', line: 4, documentId: 'followup' });
		expect(receipt.reviewer).toBe('Demo clerk');
		expect(() => store.saveDraft('corrected', version, draft)).toThrow();
	});

	it('keeps unresolved and held packets out of the receiving desk, even when a stale tab acts', () => {
		const draft = parsePacket(fixtures.ambiguous);
		store.saveDraft('ambiguous', '', draft);
		const original = store.get('ambiguous')!.version;
		store.change('ambiguous', original, 'hold');
		const held = store.get('ambiguous')!.version;
		expect(() => store.change('ambiguous', original, 'approve')).toThrow();
		expect(() => store.change('ambiguous', held, 'approve')).toThrow();
		store.change('ambiguous', held, 'resume');
		expect(() => store.change('ambiguous', store.get('ambiguous')!.version, 'approve', 'followup:4')).toThrow();
		expect(store.receipts()).toEqual([]);
	});

	it('keeps the draft after a failed write and allows one successful retry', () => {
		store.saveDraft('consistent', '', parsePacket(fixtures.consistent));
		const version = store.get('consistent')!.version;
		const admin = new DatabaseSync(path);
		try {
			admin.exec("CREATE TRIGGER fail_approval BEFORE UPDATE ON packets BEGIN SELECT RAISE(ABORT, 'test write failure'); END;");
			expect(() => store.change('consistent', version, 'approve')).toThrow();
			expect(store.get('consistent')).toMatchObject({ version, status: 'review', receipt: null });
			admin.exec('DROP TRIGGER fail_approval');
		} finally { admin.close(); }
		store.change('consistent', version, 'approve');
		expect(store.receipts()).toHaveLength(1);
		expect(store.receipts()[0].values.callback.value).toBe('052');
	});

	it('resets only the selected sample and rejects an earlier version after recreation', () => {
		for (const id of ['corrected','consistent'] as const) store.saveDraft(id, '', parsePacket(fixtures[id]));
		const original = store.get('corrected')!.version;
		store.change('corrected', original, 'reset');
		expect(store.get('corrected')).toBeNull();
		expect(store.get('consistent')).toBeTruthy();
		store.saveDraft('corrected','',parsePacket(fixtures.corrected));
		expect(() => store.change('corrected', original, 'approve', 'followup:4')).toThrow();
	});
});
