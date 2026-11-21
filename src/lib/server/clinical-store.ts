import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ClinicalSummary } from './clinical-summary';
import { packetStore, ReviewError } from './store';

export type ClinicalRecipientRole = 'Doctor' | 'Nurse';
export type ClinicalReviewRole = 'Doctor' | 'Administrative staff';

export interface ClinicalHandoff {
	id: string;
	taskId: string;
	recipient: ClinicalRecipientRole;
	signedBy: string;
	sentAt: string;
	acknowledgedAt: string | null;
}

interface StoredState {
	status: 'draft' | 'sent' | 'acknowledged';
	summary: ClinicalSummary;
	sourceText: string;
	elapsedMs: number;
	history: ClinicalHandoff[];
}

export interface ClinicalState extends StoredState {
	version: string;
}

function isRecipient(role: unknown): role is ClinicalRecipientRole {
	return role === 'Doctor' || role === 'Nurse';
}

function requireOwner(state: StoredState | null, role: ClinicalRecipientRole) {
	const active = state?.history.at(-1);
	if (!state || !active || active.recipient !== role) {
		throw new ReviewError('This inbox no longer owns the active handoff.');
	}
	return { state, active };
}

function send(state: StoredState, taskId: string, signedBy: string): StoredState {
	const task = state.summary.tasks.find((candidate) => candidate.id === taskId);
	if (!task || !isRecipient(task.role)) throw new ReviewError('Choose a documented task.', 400);
	if (state.history.some((event) => event.taskId === task.id)) {
		throw new ReviewError('This task was already sent.');
	}
	const event: ClinicalHandoff = {
		id: randomUUID(), taskId: task.id, recipient: task.role, signedBy,
		sentAt: new Date().toISOString(), acknowledgedAt: null
	};
	return { ...state, status: 'sent', history: [...state.history, event] };
}

export class ClinicalStore {
	constructor(private readonly db: DatabaseSync) {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS clinical_handoff (
				singleton INTEGER PRIMARY KEY CHECK(singleton=1),
				version TEXT NOT NULL,
				data TEXT,
				last_request TEXT
			);
			INSERT INTO clinical_handoff(singleton, version) VALUES (1, '')
			ON CONFLICT(singleton) DO NOTHING;
		`);
	}

	private read() {
		const row = this.db.prepare('SELECT version, data, last_request FROM clinical_handoff WHERE singleton=1').get()!;
		const version = row.version as string;
		const data = row.data === null ? null : JSON.parse(row.data as string) as StoredState;
		return { version, data, lastRequest: row.last_request as string | null };
	}

	get(): ClinicalState | null {
		const { data, version } = this.read();
		return data && { ...data, version };
	}

	version(): string { return this.read().version; }

	private change(version: string, request: unknown[], update: (state: StoredState | null) => StoredState): ClinicalState;
	private change(version: string, request: unknown[], update: (state: StoredState | null) => null): null;
	private change(version: string, request: unknown[], update: (state: StoredState | null) => StoredState | null) {
		const key = createHash('sha256').update(JSON.stringify([version, ...request])).digest('hex');
		const before = this.read();
		if (before.lastRequest === key) return before.data && { ...before.data, version: before.version };
		if (before.version !== version) throw new ReviewError('This handoff changed. Review the latest version.');

		const data = update(before.data);
		const newVersion = randomUUID();
		const saved = this.db.prepare('UPDATE clinical_handoff SET version=?, data=?, last_request=? WHERE singleton=1 AND version=?')
			.run(newVersion, data && JSON.stringify(data), key, version);
		if (!saved.changes) {
			const after = this.read();
			if (after.lastRequest === key) return after.data && { ...after.data, version: after.version };
			throw new ReviewError('This handoff changed. Review the latest version.');
		}
		return data && { ...data, version: newVersion };
	}

	saveSummary(version: string, summary: ClinicalSummary, elapsedMs: number, sourceText: string): ClinicalState {
		if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || typeof sourceText !== 'string' || !sourceText.trim()) {
			throw new ReviewError('The extraction needs its source text and elapsed time.', 400);
		}
		return this.change(version, ['save', summary, elapsedMs, sourceText], (state) => {
			if (state && state.status !== 'draft') throw new ReviewError('The signed summary is read-only.');
			return { status: 'draft', summary, elapsedMs, sourceText, history: [] };
		});
	}

	approve(version: string, reviewer: ClinicalReviewRole, taskId: string): ClinicalState {
		if (reviewer !== 'Doctor' && reviewer !== 'Administrative staff') {
			throw new ReviewError('Choose a valid reviewing role.', 400);
		}
		return this.change(version, ['approve', reviewer, taskId], (state) => {
			if (!state || state.status !== 'draft') throw new ReviewError('A reviewed draft is required to send a handoff.');
			if (state.summary.issues.length) throw new ReviewError('Resolve the extraction issues before signing off.', 400);
			return send(state, taskId, reviewer === 'Doctor' ? 'Reviewing doctor' : reviewer);
		});
	}

	acknowledge(version: string, role: ClinicalRecipientRole): ClinicalState {
		if (!isRecipient(role)) throw new ReviewError('Choose a valid receiving role.', 400);
		return this.change(version, ['acknowledge', role], (record) => {
			const { state, active } = requireOwner(record, role);
			if (active.acknowledgedAt !== null) throw new ReviewError('This handoff receipt has already been recorded.');
			const acknowledged = { ...active, acknowledgedAt: new Date().toISOString() };
			return { ...state, status: 'acknowledged', history: [...state.history.slice(0, -1), acknowledged] };
		});
	}

	forward(version: string, role: ClinicalRecipientRole, taskId: string): ClinicalState {
		if (!isRecipient(role)) throw new ReviewError('Choose a valid receiving role.', 400);
		return this.change(version, ['forward', role, taskId], (record) => {
			const { state } = requireOwner(record, role);
			return send(state, taskId, role === 'Doctor' ? 'Receiving doctor' : 'Receiving nurse');
		});
	}

	reset(version: string): void {
		this.change(version, ['reset'], () => null);
	}
}

export function clinicalStore() { return packetStore().clinical; }
