import type { DemoAccount } from './lib/server/accounts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals { account: DemoAccount | null }
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
