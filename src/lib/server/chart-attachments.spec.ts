import { expect, test } from 'vitest';
import { demoAccounts } from './accounts';
import { PacketStore } from './store';

test('new files are visible to all staff under the right patient and visit; retries and invalid batches are safe', async () => {
	const store = new PacketStore(':memory:');
	const [maya, avery] = demoAccounts;
	const prior = new File(['Synthetic study report.'], 'September report.txt');
	const nursing = new File(['Synthetic nursing note.'], 'Nursing note.txt');
	try {
		await expect(store.patients.fileAttachments('J-104', 'ED-116', [prior], avery)).rejects.toThrow(/visit/);
		await expect(store.patients.fileAttachments('J-104', 'ED-082', [prior, new File(['broken'], 'x.pdf')], avery)).rejects.toThrow(/PDF/);
		expect(store.patients.view(maya, null, '', false, 'J-104').uploads).toHaveLength(0);
		expect(await store.patients.fileAttachments('J-104', 'ED-082', [prior, nursing], avery)).toBe(2);
		expect(await store.patients.fileAttachments('J-104', 'ED-082', [prior], maya)).toBe(0);
		for (const staff of demoAccounts) {
			const uploads = store.patients.view(staff, null, '', false, 'J-104').uploads;
			expect(uploads).toHaveLength(2);
			const entry = uploads.find(row => row.name === 'September report.txt')!;
			expect(entry).toMatchObject({visitId: 'ED-082', filedBy: avery.name});
			const file = store.patients.filedAttachment('J-104','ED-082',entry.id)!;
			expect(Buffer.from(file.bytes).toString()).toBe('Synthetic study report.');
			expect(store.patients.filedAttachment('C-116','ED-082',entry.id)).toBeUndefined();
			expect(store.patients.filedAttachment('J-104','ED-104',entry.id)).toBeUndefined();
			expect(store.patients.view(staff,null,'',false,'C-116').uploads).toEqual([]);
		}
	} finally { store.close(); }
});
