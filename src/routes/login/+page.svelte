<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { demoPasscodes } from '../../lib/demo-accounts';
	import DemoStep from '#lib/ui/DemoStep.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let accountId = $state<keyof typeof demoPasscodes>(untrack(() => data.guide ? 'nurse' : 'admin'));
	let passcode = $state(untrack(() => data.guide ? demoPasscodes.nurse : ''));
</script>

<svelte:head><title>Sign in · Intake Desk</title></svelte:head>
<div class="login-layout">
	<section class="welcome">
		<p class="kicker">Mossbridge Community Hospital</p>
		<h1>Intake Desk</h1>
		<p class="lead">Find a patient, read the latest update, and see who owns the next task.</p>
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
			<div class="demo-code"><span>Demo passcode <code>{demoPasscodes[accountId]}</code></span><button type="button" class="text-button" onclick={() => passcode = demoPasscodes[accountId]}>Fill passcode</button></div>
			<button class="button sign-in" type="submit">{#if accountId === 'nurse'}<DemoStep n={1} owner="nurse"/>{/if}Sign in</button>
		</form>
	</section>
</div>
