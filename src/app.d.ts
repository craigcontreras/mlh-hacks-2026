import type { DemoAccount } from './lib/server/accounts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals { account: DemoAccount | null }
		interface PageData { guide?: { owner?: DemoAccount; signedBy?: string } | null }
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
