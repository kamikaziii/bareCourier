import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			// TypeScript handles this better — avoids false positives on global types
			'no-undef': 'off',
			// Allow explicit any when needed, but warn on implicit
			'@typescript-eslint/no-explicit-any': 'warn',
			// Unused vars: warn, allow _ prefix and $$-prefixed (Svelte internals)
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^(_|\\$\\$)'
				}
			],
			// Allow empty functions (common in Svelte event handlers)
			'@typescript-eslint/no-empty-function': 'off',
			// Svelte reactive patterns trigger false positives
			'@typescript-eslint/no-unused-expressions': 'off',
			// Deprecated in typescript-eslint v8
			'@typescript-eslint/ban-types': 'off',
			// Existing @ts-ignore comments — clean up gradually
			'@typescript-eslint/ban-ts-comment': 'warn',
			// Leftover svelte-ignore comments from Svelte 4→5 migration — clean up gradually
			'svelte/no-unused-svelte-ignore': 'warn',
			// Valid for i18n but needs incremental adoption
			'svelte/no-navigation-without-resolve': 'warn',
			// Good Svelte 5 patterns — adopt incrementally
			'svelte/prefer-svelte-reactivity': 'warn',
			'svelte/prefer-writable-derived': 'warn',
			'svelte/require-each-key': 'warn'
		}
	},
	{
		ignores: [
			'.svelte-kit/',
			'.vercel/',
			'build/',
			'dev-dist/',
			'node_modules/',
			'src/paraglide/',
			'src/lib/paraglide/',
			'src/lib/components/ui/',
			'e2e/archive/',
			'supabase/functions/',
			'*.config.js',
			'*.config.ts',
			'scripts/'
		]
	}
);
