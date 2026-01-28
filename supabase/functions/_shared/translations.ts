// Notification translations for edge functions
// Supported locales: 'pt-PT' (default), 'en'

export type SupportedLocale = 'pt-PT' | 'en';

interface TranslationParams {
	[key: string]: string | number;
}

const translations: Record<string, Record<SupportedLocale, string>> = {
	// Past due notifications
	past_due_title: {
		'pt-PT': 'Entrega Atrasada',
		en: 'Past Due Delivery'
	},
	past_due_message: {
		'pt-PT': 'Entrega de {client_name} está {overdue_text} atrasada',
		en: 'Delivery for {client_name} is {overdue_text} overdue'
	},

	// Daily summary
	daily_summary_title: {
		'pt-PT': 'Resumo do Dia',
		en: 'Daily Summary'
	},
	daily_summary_no_services: {
		'pt-PT': 'Não tem entregas agendadas para hoje.',
		en: 'No deliveries scheduled for today.'
	},
	daily_summary_all_done: {
		'pt-PT': 'Todas as {total} entregas de hoje foram concluídas!',
		en: 'All {total} deliveries for today have been completed!'
	},
	daily_summary_pending: {
		'pt-PT': 'Tem {total} entrega hoje: {pending} pendente.',
		en: 'You have {total} delivery today: {pending} pending.'
	},
	daily_summary_pending_plural: {
		'pt-PT': 'Tem {total} entregas hoje: {pending} pendentes.',
		en: 'You have {total} deliveries today: {pending} pending.'
	},
	daily_summary_with_urgent: {
		'pt-PT': 'Tem {total} entregas hoje: {pending} pendentes, {urgent} urgentes.',
		en: 'You have {total} deliveries today: {pending} pending, {urgent} urgent.'
	},

	// Overdue time formats
	overdue_minutes: {
		'pt-PT': '{minutes} minutos',
		en: '{minutes} minutes'
	},
	overdue_hour: {
		'pt-PT': '{hours} hora',
		en: '{hours} hour'
	},
	overdue_hours: {
		'pt-PT': '{hours} horas',
		en: '{hours} hours'
	},
	overdue_day: {
		'pt-PT': '{days} dia',
		en: '{days} day'
	},
	overdue_days: {
		'pt-PT': '{days} dias',
		en: '{days} days'
	}
};

export function t(key: string, locale: SupportedLocale, params?: TranslationParams): string {
	const translation = translations[key];
	if (!translation) {
		console.warn(`Missing translation key: ${key}`);
		return key;
	}

	let text = translation[locale] || translation['pt-PT'];

	// Replace placeholders
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
		}
	}

	return text;
}

export function formatOverdueTime(minutes: number, locale: SupportedLocale): string {
	if (minutes < 60) {
		return t('overdue_minutes', locale, { minutes: Math.round(minutes) });
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return hours === 1
			? t('overdue_hour', locale, { hours })
			: t('overdue_hours', locale, { hours });
	}
	const days = Math.floor(hours / 24);
	return days === 1 ? t('overdue_day', locale, { days }) : t('overdue_days', locale, { days });
}

export function getLocale(locale: string | null | undefined): SupportedLocale {
	if (locale === 'en') return 'en';
	return 'pt-PT';
}
