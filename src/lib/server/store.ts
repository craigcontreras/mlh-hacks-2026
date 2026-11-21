import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AccountId, DemoAccount } from './accounts';
import { ClinicalStore } from './clinical-store';
import { PatientRegistry } from './patient-registry';
import { resolveDraft, type Draft, type Evidence, type Field } from './extraction';
import { fixtures, type FixtureId } from './fixtures';

export interface Receipt {
	packetId: string;
	values: Record<Field, Evidence & { documentTitle?: string }>;
	reviewer: string;
	reviewerAccountId?: AccountId;
	destination: string;
	approvedAt: string;
	method: Draft['method'];
}

export interface PacketRecord {
	version: string;
	status: 'review' | 'held' | 'approved';
	draft: Draft;
	receipt: Receipt | null;
}

export class ReviewError extends Error {
	constructor(message: string, readonly status: 400 | 409 = 409) { super(message); }
}

function stale() {
	return new ReviewError('This packet changed. Review the latest version before continuing.');
}

export class PacketStore {
	private db: DatabaseSync;
	readonly clinical: ClinicalStore;
	readonly patients: PatientRegistry;

	constructor(filename: string) {
		if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
		this.db = new DatabaseSync(filename);
		this.db.exec(`PRAGMA busy_timeout=3000;
			CREATE TABLE IF NOT EXISTS packets (
				sample TEXT PRIMARY KEY, version TEXT NOT NULL,
				status TEXT NOT NULL CHECK(status IN ('review','held','approved')),
				draft TEXT NOT NULL, receipt TEXT,
				CHECK((status='approved') = (receipt IS NOT NULL))
			)`);
		this.clinical = new ClinicalStore(this.db);
		this.patients = new PatientRegistry(this.db);
	}

	get(id: FixtureId): PacketRecord | null {
		const row = this.db.prepare('SELECT * FROM packets WHERE sample=?').get(id);
		if (!row) return null;
		return {
			version: String(row.version), status: row.status as PacketRecord['status'],
			draft: JSON.parse(String(row.draft)) as Draft,
			receipt: row.receipt === null ? null : JSON.parse(String(row.receipt)) as Receipt
		};
	}

	receipts(): Receipt[] {
		return this.db.prepare("SELECT receipt FROM packets WHERE status='approved' ORDER BY json_extract(receipt,'$.approvedAt') DESC")
			.all().map(row => JSON.parse(String(row.receipt)) as Receipt);
	}

	saveDraft(id: FixtureId, version: string, draft: Draft) {
		const newVersion = randomUUID();
		const data = JSON.stringify(draft);
		const result = version
			? this.db.prepare("UPDATE packets SET version=?, draft=? WHERE sample=? AND version=? AND status='review'").run(newVersion, data, id, version)
			: this.db.prepare("INSERT INTO packets(sample,version,status,draft) VALUES (?,?,'review',?) ON CONFLICT(sample) DO NOTHING").run(id, newVersion, data);
		if (!result.changes) throw stale();
	}

	change(id: FixtureId, version: string, action: 'hold' | 'resume' | 'approve' | 'reset', account: DemoAccount, selectedRef: string | null = null) {
		if (account.role !== 'Administrative staff') throw new ReviewError('Registration requires the triage agent.', 400);
		const record = this.get(id);
		if (!record) throw stale();
		// Retries of a completed sign-off read the existing receipt without changing its time.
		if (action === 'approve' && record.status === 'approved') return;
		if (record.version !== version) throw stale();
		if (action === 'reset') {
			if (!this.db.prepare('DELETE FROM packets WHERE sample=? AND version=?').run(id, version).changes) throw stale();
			return;
		}
		const requiredStatus = action === 'resume' ? 'held' : 'review';
		if (record.status !== requiredStatus) throw new ReviewError('This action is unavailable for the current packet status.');
		let receipt: Receipt | null = null;
		if (action === 'approve') {
			let values: Record<Field, Evidence>;
			try { values = resolveDraft(record.draft, selectedRef); }
			catch (error) { throw new ReviewError(error instanceof Error ? error.message : 'Review the source fields before approval.', 400); }
			const cited = (value: Evidence) => ({
				...value, documentTitle: fixtures[id].documents.find(doc => doc.id === value.documentId)?.title ?? value.documentId
			});
			receipt = {
				packetId: record.draft.packetId,
				values: { patient: cited(values.patient), facility: cited(values.facility), callback: cited(values.callback) },
				reviewer: account.name, reviewerAccountId: account.id, destination: 'Registration desk',
				approvedAt: new Date().toISOString(), method: record.draft.method
			};
		}
		const status = action === 'hold' ? 'held' : action === 'resume' ? 'review' : 'approved';
		const result = this.db.prepare('UPDATE packets SET version=?, status=?, receipt=? WHERE sample=? AND version=?')
			.run(randomUUID(), status, receipt && JSON.stringify(receipt), id, version);
		if (!result.changes) {
			if (action === 'approve' && this.get(id)?.status === 'approved') return;
			throw stale();
		}
	}

	close() { this.db.close(); }
}

let store: PacketStore | undefined;
export function packetStore() {
	return store ??= new PacketStore(resolve(process.env.INTAKE_DB_PATH || '.data/intake.sqlite'));
}
