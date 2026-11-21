<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import '#lib/ui/intake.css';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="theme-color" content="#183d36" />
	<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23d9ebcf'/%3E%3Cg fill='%23d9ebcf' stroke='%23183d36' stroke-width='2'%3E%3Crect x='8' y='6' width='12' height='16' rx='1'/%3E%3Crect x='12' y='10' width='12' height='16' rx='1'/%3E%3Cpath d='M15 16h6m-6 4h6'/%3E%3C/g%3E%3C/svg%3E" />
</svelte:head>

<a class="skip-link" href="#content">Skip to content</a>
<header class="mast">
	<div class="shell topbar">
		<a class="brand" href={resolve('/handoffs')} aria-label="Intake Desk home"><span class="brandmark" aria-hidden="true"></span>Intake Desk</a>
		<nav class="workspace-nav" aria-label="Workspaces">
			<a href={resolve('/handoffs')} aria-current={page.url.pathname === resolve('/handoffs') ? 'page' : undefined}>Handoff review</a>
			<a href={resolve('/inbox')} aria-current={page.url.pathname === resolve('/inbox') ? 'page' : undefined}>Worker inbox</a>
		</nav>
		<span class="demo-flag"><i aria-hidden="true"></i>Synthetic data</span>
	</div>
</header>
<main id="content" class="shell main" tabindex="-1">
	{@render children()}
</main>

<footer class="shell app-footer">
	<nav aria-label="Registration workflow">
		<span>Registration workflow</span>
		<a href={resolve('/?sample=corrected')} aria-current={page.url.pathname === resolve('/') ? 'page' : undefined}>Transfer packets</a>
		<a href={resolve('/desk')} aria-current={page.url.pathname === resolve('/desk') ? 'page' : undefined}>Registration desk</a>
	</nav>
</footer>
