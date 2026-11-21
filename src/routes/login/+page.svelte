<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const demoCodes = { admin: 'maya-demo-104', doctor: 'avery-demo-104', nurse: 'riley-demo-104', 'doctor-morgan': 'morgan-demo-104' };
	let accountId = $state<keyof typeof demoCodes>('admin');
	let passcode = $state('');
</script>

<svelte:head><title>Sign in · Intake Desk</title></svelte:head>
<div class="login-layout">
	<section class="welcome">
		<p class="kicker">Mossbridge Community Hospital</p>
		<h1>Intake Desk</h1>
		<p class="lead">The transfer workspace for administrative staff, doctors, and nurses.</p>
		<div class="welcome-line"><span class="brandmark" aria-hidden="true"></span><span>Fictional hospital · Synthetic patient records</span></div>
	</section>
	<section class="paper-card login-card">
		<h2>Sign in to your workspace</h2>
		<form method="POST" use:enhance>
			{#if form?.message}<p class="notice error" role="alert">{form.message}</p>{/if}
			<label for="account">Demo account</label>
			<select id="account" name="accountId" bind:value={accountId} onchange={() => passcode = ''}>
				{#each data.accounts as account (account.id)}<option value={account.id}>{account.name} · {account.label}</option>{/each}
			</select>
			<label for="passcode">Passcode</label>
			<input id="passcode" type="password" name="passcode" required autocomplete="current-password" bind:value={passcode} />
			<div class="demo-code"><span>Demo passcode <code>{demoCodes[accountId]}</code></span><button type="button" class="text-button" onclick={() => passcode = demoCodes[accountId]}>Fill passcode</button></div>
			<button class="button sign-in" type="submit">Sign in</button>
		</form>
	</section>
</div>
