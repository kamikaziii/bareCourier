<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	/**
	 * Maps Supabase auth error messages to user-friendly Portuguese messages.
	 * Prevents exposing internal auth implementation details.
	 */
	function mapAuthError(errorMessage: string): string {
		const errorMap: Record<string, string> = {
			'Invalid login credentials': 'Email ou password incorretos',
			'Email not confirmed': 'Por favor, confirme o seu email antes de entrar',
			'User not found': 'Email ou password incorretos',
			'Invalid email or password': 'Email ou password incorretos',
			'Too many requests': 'Demasiadas tentativas. Aguarde alguns minutos',
			'Email rate limit exceeded': 'Demasiadas tentativas. Aguarde alguns minutos',
			'User already registered': 'Este email já está registado'
		};

		// Check for exact match first
		if (errorMap[errorMessage]) {
			return errorMap[errorMessage];
		}

		// Check for partial matches (some errors include dynamic content)
		for (const [key, value] of Object.entries(errorMap)) {
			if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
				return value;
			}
		}

		// Generic fallback - don't expose raw error
		return 'Ocorreu um erro ao iniciar sessão. Tente novamente';
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const { error: authError } = await data.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (authError) {
			error = mapAuthError(authError.message);
			loading = false;
			return;
		}

		// Redirect will happen via layout auth state change
		goto(localizeHref('/'));
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="text-center">
			<Card.Title class="text-2xl">{m.app_name()}</Card.Title>
			<Card.Description>{m.auth_sign_in_subtitle()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleLogin} class="space-y-4">
				{#if error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="email">{m.auth_email()}</Label>
					<Input
						id="email"
						type="email"
						placeholder={m.auth_email_placeholder()}
						bind:value={email}
						required
						disabled={loading}
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">{m.auth_password()}</Label>
					<Input
						id="password"
						type="password"
						placeholder={m.auth_password_placeholder()}
						bind:value={password}
						required
						disabled={loading}
					/>
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? m.auth_signing_in() : m.auth_sign_in()}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
