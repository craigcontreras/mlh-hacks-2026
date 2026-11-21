<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import '#lib/ui/intake.css';

	let { children, data }: LayoutProps = $props();
	const admin = $derived(data.account?.role === 'Administrative staff');
</script>

<svelte:head>
	<meta name="theme-color" content="#183d36" />
	<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23d9ebcf'/%3E%3Cg fill='%23d9ebcf' stroke='%23183d36' stroke-width='2'%3E%3Crect x='8' y='6' width='12' height='16' rx='1'/%3E%3Crect x='12' y='10' width='12' height='16' rx='1'/%3E%3Cpath d='M15 16h6m-6 4h6'/%3E%3C/g%3E%3C/svg%3E" />
</svelte:head>

<a class="skip-link" href="#content">Skip to content</a>
<header class="mast">
	<div class="shell topbar">
		<a class="brand" href={resolve(!data.account ? '/login' : admin ? '/handoffs' : '/inbox')} aria-label="Intake Desk home"><span class="brandmark" aria-hidden="true"></span>Intake Desk</a>
		{#if data.account}
			<nav class="workspace-nav" aria-label="Workspaces">
				{#if !admin}<a href={resolve('/inbox')} aria-current={page.url.pathname === resolve('/inbox') ? 'page' : undefined}>My inbox</a>{/if}
				<a href={resolve('/handoffs')} aria-current={page.url.pathname === resolve('/handoffs') ? 'page' : undefined}>{admin ? 'Transfer workspace' : 'Patient chart'}</a>
				<a href={resolve('/patients')} aria-current={page.url.pathname === resolve('/patients') ? 'page' : undefined}>Patient records</a>
			</nav>
			<div class="account-nav"><span>{data.account.name}<small>{data.account.label} · Demo</small></span>
				<form method="POST" action={resolve('/logout')}><button type="submit">Sign out</button></form></div>
		{:else}<span class="demo-flag"><i aria-hidden="true"></i>Synthetic demo</span>{/if}
	</div>
</header>
<main id="content" class="shell main" tabindex="-1">
	{@render children()}
</main>

{#if admin}<footer class="shell app-footer">
	<nav aria-label="Registration workflow">
		<span>Registration workflow</span>
		<a href={resolve('/?sample=corrected')} aria-current={page.url.pathname === resolve('/') ? 'page' : undefined}>Transfer packets</a>
		<a href={resolve('/desk')} aria-current={page.url.pathname === resolve('/desk') ? 'page' : undefined}>Registration desk</a>
	</nav>
</footer>{/if}
