import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import {
	authenticateDemoAccount, demoAccounts, endSession, requireAccountRole, sessionAccount, sessionCookie, startSession
} from './accounts';

const [admin, doctor, nurse] = demoAccounts;

describe('demo account authority', () => {
	it('requires the individual account passcode and returns no passcode in the account', () => {
		expect(authenticateDemoAccount('admin', 'maya-demo-104')).toEqual(admin);
		expect(authenticateDemoAccount('doctor', 'avery-demo-104')).toEqual(doctor);
		expect(authenticateDemoAccount('nurse', 'riley-demo-104')).toEqual(nurse);
		expect(authenticateDemoAccount('doctor', 'riley-demo-104')).toBeNull();
		expect(authenticateDemoAccount('admin', null)).toBeNull();
		expect(admin).not.toHaveProperty('passcode');
	});

	it('rotates opaque sessions on sign-in and invalidates the token on sign-out or expiry', () => {
		let token: string | undefined;
		const cookies = {
			get: () => token,
			set: vi.fn<Cookies['set']>((_, value) => { token = value; }),
			delete: vi.fn<Cookies['delete']>(() => { token = undefined; })
		};
		vi.useFakeTimers();
		try {
			startSession(cookies, admin, false);
			const first = token;
			expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
			expect(sessionAccount(first)).toEqual(admin);
			expect(cookies.set).toHaveBeenCalledWith(sessionCookie, first, {
				path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 28800
			});

			startSession(cookies, doctor, true);
			const second = token;
			expect(second).not.toBe(first);
			expect(sessionAccount(first)).toBeNull();
			expect(sessionAccount(second)).toEqual(doctor);
			expect(cookies.set.mock.calls.at(-1)?.[2]?.secure).toBe(true);
			endSession(cookies);
			expect(sessionAccount(second)).toBeNull();
			expect(cookies.delete).toHaveBeenCalledWith(sessionCookie, { path: '/' });

			startSession(cookies, nurse, true);
			const third = token;
			vi.advanceTimersByTime(8 * 60 * 60 * 1000);
			expect(sessionAccount(third)).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('admits only the authenticated role to restricted views', () => {
		expect(requireAccountRole({ account: admin }, 'Administrative staff')).toEqual(admin);
		expect(requireAccountRole({ account: nurse }, 'Doctor', 'Nurse')).toEqual(nurse);
		expect(() => requireAccountRole({ account: doctor }, 'Administrative staff'))
			.toThrow(expect.objectContaining({ status: 403 }));
		expect(() => requireAccountRole({ account: null }, 'Administrative staff'))
			.toThrow(expect.objectContaining({ status: 303, location: '/login' }));
	});
});
