import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { AccountId, DemoAccount } from './accounts';
import { chartDocuments, chartPatient, type ChartDocument, type ChartEvidence } from './chart';
import type { ClinicalSummary } from './clinical-summary';
import { packetStore, ReviewError } from './store';

export type ClinicalRecipientRole = 'Doctor' | 'Nurse';

export interface ClinicalHandoff {
	id: string;
	taskId: string;
	recipient: ClinicalRecipientRole;
	signedBy: string;
	signedByAccountId?: AccountId;
	sentAt: string;
	acknowledgedAt: string | null;
	acknowledgedBy?: string;
	acknowledgedByAccountId?: AccountId;
}

interface PriorStudyRequest {
	accession: string;
	text: string;
	evidence: ChartEvidence[];
	requestedBy: string;
	requestedByAccountId: AccountId;
	requestedAt: string;
	status: 'Queued for imaging records';
}

interface StoredState {
	status: 'draft' | 'sent' | 'acknowledged';
	summary: ClinicalSummary;
	sourceText: string;
	sources?: ChartDocument[];
	elapsedMs: number;
	history: ClinicalHandoff[];
	priorStudyRequest?: PriorStudyRequest;
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

function send(state: StoredState, taskId: string, account: DemoAccount): StoredState {
	const task = state.summary.tasks.find((candidate) => candidate.id === taskId);
	if (!task || !isRecipient(task.role)) throw new ReviewError('Choose a documented task.', 400);
	if (state.history.some((event) => event.taskId === task.id)) {
		throw new ReviewError('This task was already sent.');
	}
	const event: ClinicalHandoff = {
		id: randomUUID(), taskId: task.id, recipient: task.role,
		signedBy: account.name, signedByAccountId: account.id,
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
		if (data === before.data) return data && { ...data, version: before.version };
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

	saveSummary(version: string, summary: ClinicalSummary, elapsedMs: number, sourceText: string, sources?: ChartDocument[]): ClinicalState {
		if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || typeof sourceText !== 'string' || !sourceText.trim()) {
			throw new ReviewError('The extraction needs its source text and elapsed time.', 400);
		}
		return this.change(version, ['save', summary, elapsedMs, sourceText, sources], (state) => {
			if (state && state.status !== 'draft') throw new ReviewError('The signed summary is read-only.');
			if (state?.priorStudyRequest && (state.sourceText !== sourceText || JSON.stringify(state.sources) !== JSON.stringify(sources))) {
				throw new ReviewError('The queued request already cites this version of the chart.');
			}
			return { ...state, status: 'draft', summary, elapsedMs, sourceText, sources, history: [] };
		});
	}

	approve(version: string, account: DemoAccount, taskId: string): ClinicalState {
		if (account.role !== 'Administrative staff') throw new ReviewError('Sending the initial handoff requires an administrator.', 400);
		return this.change(version, ['approve', account.id, taskId], (state) => {
			if (!state || state.status !== 'draft') throw new ReviewError('A reviewed draft is required to send a handoff.');
			if (state.summary.issues.length) throw new ReviewError('Resolve the extraction issues before signing off.', 400);
			return send(state, taskId, account);
		});
	}

	acknowledge(version: string, account: DemoAccount): ClinicalState {
		const { role } = account;
		if (!isRecipient(role)) throw new ReviewError('Choose a valid receiving role.', 400);
		return this.change(version, ['acknowledge', account.id], (record) => {
			const { state, active } = requireOwner(record, role);
			if (active.acknowledgedAt !== null) throw new ReviewError('This handoff receipt has already been recorded.');
			const acknowledged = {
				...active, acknowledgedAt: new Date().toISOString(),
				acknowledgedBy: account.name, acknowledgedByAccountId: account.id
			};
			return { ...state, status: 'acknowledged', history: [...state.history.slice(0, -1), acknowledged] };
		});
	}

	forward(version: string, account: DemoAccount, taskId: string): ClinicalState {
		const { role } = account;
		if (!isRecipient(role)) throw new ReviewError('Choose a valid receiving role.', 400);
		return this.change(version, ['forward', account.id, taskId], (record) => {
			const { state } = requireOwner(record, role);
			return send(state, taskId, account);
		});
	}

	requestPriorStudy(version: string, account: DemoAccount): ClinicalState {
		if (account.role !== 'Administrative staff') throw new ReviewError('A prior-study request requires an administrator.', 400);
		return this.change(version, ['request-prior-study', account.id], (state) => {
			if (state?.priorStudyRequest) return state;
			if (!state || state.summary.issues.length || !state.summary.adminAction) {
				throw new ReviewError('A verified request from the chart is required.', 400);
			}
			return {
				...state,
				priorStudyRequest: {
					...state.summary.adminAction, requestedBy: account.name, requestedByAccountId: account.id,
					requestedAt: new Date().toISOString(), status: 'Queued for imaging records'
				}
			};
		});
	}

	reset(version: string): void {
		this.change(version, ['reset'], () => null);
	}
}

export function clinicalStore() { return packetStore().clinical; }

export function chartSnapshot(record: ClinicalState | null) {
	const documents = record?.sources ?? chartDocuments.map((document) =>
		record && document.id === 'ED-104' ? { ...document, text: record.sourceText } : document
	);
	return { patient: chartPatient, documents };
}
