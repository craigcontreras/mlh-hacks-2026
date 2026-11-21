import { randomBytes, timingSafeEqual } from 'node:crypto';
import { error, redirect, type Cookies } from '@sveltejs/kit';
import { demoPasscodes } from '../demo-accounts';

export type AccountId = 'admin' | 'doctor' | 'nurse' | 'doctor-morgan';
export type AccountRole = 'Administrative staff' | 'Doctor' | 'Nurse';

export interface DemoAccount {
	id: AccountId;
	name: string;
	role: AccountRole;
	label: 'Admin' | 'Doctor' | 'Nurse';
}

export const demoAccounts: readonly DemoAccount[] = [
	{ id: 'admin', name: 'Maya Chen', role: 'Administrative staff', label: 'Admin' },
	{ id: 'doctor', name: 'Dr. Avery Shah', role: 'Doctor', label: 'Doctor' },
	{ id: 'nurse', name: 'Riley Ortiz', role: 'Nurse', label: 'Nurse' },
	{ id: 'doctor-morgan', name: 'Dr. Morgan Lee', role: 'Doctor', label: 'Doctor' }
];

export const doctorAccounts = demoAccounts.filter((account) => account.role === 'Doctor');

export const sessionCookie = 'intake_session';
const sessionMaxAge = 8 * 60 * 60;
const sessions = new Map<string, { account: DemoAccount; expiresAt: number }>();

export function authenticateDemoAccount(id: unknown, passcode: unknown): DemoAccount | null {
	const account = demoAccounts.find((candidate) => candidate.id === id);
	if (!account || typeof passcode !== 'string') return null;
	const expected = Buffer.from(demoPasscodes[account.id]);
	const supplied = Buffer.from(passcode);
	return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? account : null;
}

export function sessionAccount(token: string | undefined): DemoAccount | null {
	if (!token) return null;
	const session = sessions.get(token);
	if (!session) return null;
	if (session.expiresAt > Date.now()) return session.account;
	sessions.delete(token);
	return null;
}

function revokeSession(cookies: Pick<Cookies, 'get'>) {
	const token = cookies.get(sessionCookie);
	if (token) sessions.delete(token);
}

export function startSession(cookies: Pick<Cookies, 'get' | 'set'>, account: DemoAccount, secure: boolean) {
	revokeSession(cookies);
	const now = Date.now();
	for (const [token, session] of sessions) {
		if (session.expiresAt <= now) sessions.delete(token);
	}
	const token = randomBytes(32).toString('base64url');
	sessions.set(token, { account, expiresAt: now + sessionMaxAge * 1000 });
	cookies.set(sessionCookie, token, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: sessionMaxAge });
}

export function endSession(cookies: Pick<Cookies, 'get' | 'delete'>) {
	revokeSession(cookies);
	cookies.delete(sessionCookie, { path: '/' });
}

export function requireAccount(locals: App.Locals): DemoAccount {
	if (!locals.account) redirect(303, '/login');
	return locals.account;
}

export function requireAccountRole<Role extends AccountRole>(
	locals: App.Locals, ...roles: Role[]
): DemoAccount & { role: Role } {
	const account = requireAccount(locals);
	if (!roles.some((role) => role === account.role)) error(403, 'This view is unavailable to your account.');
	return account as DemoAccount & { role: Role };
}
