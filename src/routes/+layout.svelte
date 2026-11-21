<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import { demoPasscodes, signInSteps } from '../lib/demo-accounts';
	import DemoStep from '#lib/ui/DemoStep.svelte';
	import '#lib/ui/intake.css';

	let { children, data }: LayoutProps = $props();
	const admin = $derived(data.account?.role === 'Administrative staff');
	const guideOwner = $derived(data.guide?.owner);
	const guideWorkspace = $derived(guideOwner?.id === 'admin' ? '/handoffs' : '/inbox');
	const atGuideWorkspace = $derived(page.url.pathname === guideWorkspace || (guideWorkspace === '/inbox' && page.url.pathname === '/inbox/J-104'));

</script>

{#snippet guideToggle(enable: boolean)}
	<form method="GET" data-sveltekit-reload>
		{#each Array.from(page.url.searchParams).filter(([name]) => name !== 'guide' && !name.startsWith('/')) as [name, value], i (i)}
			<input type="hidden" {name} {value} />
		{/each}
		<button class="guide-toggle" type="submit" name="guide" value={enable ? 'jordan' : 'off'}>{enable ? 'Guide Jordan’s demo' : 'End guide'}</button>
	</form>
{/snippet}

<svelte:head>
	<meta name="theme-color" content="#222222" />
	<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23222222'/%3E%3Cg fill='%23222222' stroke='%23ffffff' stroke-width='2'%3E%3Crect x='8' y='6' width='12' height='16' rx='1'/%3E%3Crect x='12' y='10' width='12' height='16' rx='1'/%3E%3Cpath d='M15 16h6m-6 4h6'/%3E%3C/g%3E%3C/svg%3E" />
</svelte:head>

<a class="skip-link" href="#content">Skip to content</a>
<header class="mast">
	<div class="shell topbar">
		<a class="brand" href={resolve(data.account ? '/patients' : '/login')} aria-label="Intake Desk home"><span class="brandmark" aria-hidden="true"></span>Intake Desk</a>
		{#if data.account}
			<nav class="workspace-nav" aria-label="Workspaces">
				<a href={resolve('/patients')} aria-current={page.url.pathname === resolve('/patients') ? 'page' : undefined}>Patients</a>
				{#if !admin}<a href={resolve('/inbox')} aria-current={page.url.pathname === resolve('/inbox') ? 'page' : undefined}>My inbox</a>{/if}
				{#if admin}<a href={resolve('/handoffs')} aria-current={page.url.pathname === resolve('/handoffs') ? 'page' : undefined}>Transfer workspace</a>{/if}
				<a href={resolve('/glossary')} aria-current={page.url.pathname === resolve('/glossary') ? 'page' : undefined}>Glossary</a>
			</nav>
			<div class="account-nav"><span>{data.account.name}<small>{data.account.label} · Demo</small></span>
				<form method="POST" action={resolve('/logout')}><button type="submit">Sign out</button></form></div>
		{:else}<span class="demo-flag"><i aria-hidden="true"></i>Synthetic demo</span>{/if}
	</div>
</header>
<main id="content" class="shell main" tabindex="-1">
	{#if data.guide}
		<aside class="demo-guide" aria-label="Jordan demo guide">
			<div><strong>Jordan’s demo</strong>
				{#if !data.account}<span>Start as Riley and follow the numbered circles.</span>
				{:else if data.guide.signedBy}<span>Report review signed by {data.guide.signedBy}.</span>
				{:else if guideOwner && guideOwner.id !== data.account.id}
					<form method="POST" action={resolve('/login')}>
						<input type="hidden" name="accountId" value={guideOwner.id}/>
						<input type="hidden" name="passcode" value={demoPasscodes[guideOwner.id]}/>
						<button type="submit" class="guide-switch"><DemoStep n={signInSteps[guideOwner.id]} owner={guideOwner.id}/>Sign in as {guideOwner.name}</button>
					</form>
				{:else if guideOwner && !atGuideWorkspace}<a href={resolve(guideWorkspace)}>Resume in {admin ? 'Transfer workspace' : 'My inbox'} →</a>
				{:else if guideOwner}<span>Follow the numbered circles in {guideOwner.name}’s workspace.</span>
				{:else}<span>Use Jordan’s original packet to rehearse this handoff.</span>{/if}
			</div>
			{@render guideToggle(false)}
		</aside>
	{:else if !data.account || page.url.pathname === resolve('/inbox') || page.url.pathname === resolve('/handoffs') || page.url.pathname === resolve('/patients')}
		<div class="guide-entry">{@render guideToggle(true)}</div>
	{/if}
	{@render children()}
</main>

{#if admin}<footer class="shell app-footer">
	<nav aria-label="Registration workflow">
		<span>Registration workflow</span>
		<a href={resolve('/?sample=corrected')} aria-current={page.url.pathname === resolve('/') ? 'page' : undefined}>Transfer packets</a>
		<a href={resolve('/desk')} aria-current={page.url.pathname === resolve('/desk') ? 'page' : undefined}>Registration desk</a>
	</nav>
</footer>{/if}

<style>
	.guide-entry { margin: 0 0 12px; text-align: right; }
	.guide-toggle { border: 0; background: transparent; padding: 3px; color: var(--muted); font-size: 13px; white-space: nowrap; text-decoration: underline; text-underline-offset: .18em; }
	.demo-guide, .demo-guide > div { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; }
	.demo-guide { justify-content: space-between; padding: 8px 14px; margin-bottom: 16px; background: var(--paper); border: 1px solid var(--line); border-radius: 4px; font-size: 14px; }
	.demo-guide span { color: var(--muted); }
	.guide-switch { display: inline-flex; align-items: center; padding: 4px 8px 4px 4px; background: var(--paper); border: 1px solid var(--line); border-radius: 5px; color: var(--ink); font-size: 14px; font-weight: 600; }
</style>
