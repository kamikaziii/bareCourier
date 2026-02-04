// Email-specific translations for edge functions
// Supported locales: 'pt-PT' (default), 'en'

import type { SupportedLocale } from './translations.ts';

interface TranslationParams {
	[key: string]: string | number;
}

const emailTranslations: Record<string, Record<SupportedLocale, string>> = {
	// Common labels
	email_pickup_label: {
		'pt-PT': 'Recolha:',
		en: 'Pickup:'
	},
	email_delivery_label: {
		'pt-PT': 'Entrega:',
		en: 'Delivery:'
	},
	email_footer: {
		'pt-PT': 'bareCourier - Gestão de Entregas',
		en: 'bareCourier - Courier Management'
	},

	// new_request template (courier receives when client creates request)
	email_new_request_subject: {
		'pt-PT': 'Novo Pedido de Serviço de {client_name}',
		en: 'New Service Request from {client_name}'
	},
	email_new_request_title: {
		'pt-PT': 'Novo Pedido de Serviço',
		en: 'New Service Request'
	},
	email_new_request_intro: {
		'pt-PT': 'Tem um novo pedido de serviço de <strong>{client_name}</strong>.',
		en: 'You have a new service request from <strong>{client_name}</strong>.'
	},
	email_new_request_date_label: {
		'pt-PT': 'Data Pedida:',
		en: 'Requested Date:'
	},
	email_new_request_notes_label: {
		'pt-PT': 'Notas:',
		en: 'Notes:'
	},
	email_new_request_button: {
		'pt-PT': 'Ver Pedido',
		en: 'View Request'
	},

	// delivered template (client receives when service marked delivered)
	email_delivered_subject: {
		'pt-PT': 'O Seu Serviço Foi Entregue',
		en: 'Your Service Has Been Delivered'
	},
	email_delivered_title: {
		'pt-PT': 'Serviço Entregue',
		en: 'Service Delivered'
	},
	email_delivered_intro: {
		'pt-PT': 'Boas notícias! O seu serviço foi marcado como entregue.',
		en: 'Good news! Your service has been marked as delivered.'
	},
	email_delivered_at_label: {
		'pt-PT': 'Entregue:',
		en: 'Delivered:'
	},
	email_delivered_button: {
		'pt-PT': 'Ver Os Meus Serviços',
		en: 'View My Services'
	},
	email_delivered_footer: {
		'pt-PT': 'Obrigado por usar o bareCourier!',
		en: 'Thank you for using bareCourier!'
	},

	// request_accepted template (client receives when courier accepts)
	email_accepted_subject: {
		'pt-PT': 'O Seu Pedido de Serviço Foi Aceite',
		en: 'Your Service Request Has Been Accepted'
	},
	email_accepted_title: {
		'pt-PT': 'Pedido Aceite',
		en: 'Request Accepted'
	},
	email_accepted_intro: {
		'pt-PT': 'O seu pedido de serviço foi aceite pelo estafeta.',
		en: 'Your service request has been accepted by the courier.'
	},
	email_accepted_scheduled_label: {
		'pt-PT': 'Agendado:',
		en: 'Scheduled:'
	},
	email_accepted_button: {
		'pt-PT': 'Ver Os Meus Serviços',
		en: 'View My Services'
	},

	// request_rejected template (client receives when courier rejects)
	email_rejected_subject: {
		'pt-PT': 'Atualização do Pedido de Serviço',
		en: 'Service Request Update'
	},
	email_rejected_title: {
		'pt-PT': 'Pedido Indisponível',
		en: 'Request Not Available'
	},
	email_rejected_intro: {
		'pt-PT': 'Infelizmente, o estafeta não consegue satisfazer o seu pedido de serviço neste momento.',
		en: 'Unfortunately, the courier is unable to fulfill your service request at this time.'
	},
	email_rejected_reason_label: {
		'pt-PT': 'Motivo:',
		en: 'Reason:'
	},
	email_rejected_cta: {
		'pt-PT': 'Por favor, crie um novo pedido com datas diferentes.',
		en: 'Please create a new request with different dates.'
	},
	email_rejected_button: {
		'pt-PT': 'Criar Novo Pedido',
		en: 'Create New Request'
	},

	// request_suggested template (client receives when courier suggests alternative)
	email_suggested_subject: {
		'pt-PT': 'Data Alternativa Sugerida para o Seu Pedido',
		en: 'Alternative Date Suggested for Your Request'
	},
	email_suggested_title: {
		'pt-PT': 'Alternativa Sugerida',
		en: 'Alternative Suggested'
	},
	email_suggested_intro: {
		'pt-PT': 'O estafeta sugeriu uma data alternativa para o seu pedido de serviço.',
		en: 'The courier has suggested an alternative date for your service request.'
	},
	email_suggested_requested_label: {
		'pt-PT': 'O Seu Pedido:',
		en: 'Your Request:'
	},
	email_suggested_suggested_label: {
		'pt-PT': 'Sugerido:',
		en: 'Suggested:'
	},
	email_suggested_cta: {
		'pt-PT': 'Por favor, responda para aceitar ou recusar esta sugestão.',
		en: 'Please respond to accept or decline this suggestion.'
	},
	email_suggested_button: {
		'pt-PT': 'Responder à Sugestão',
		en: 'Respond to Suggestion'
	},

	// request_cancelled template (courier receives when client cancels)
	email_cancelled_subject: {
		'pt-PT': 'Pedido de Serviço Cancelado',
		en: 'Service Request Cancelled'
	},
	email_cancelled_title: {
		'pt-PT': 'Pedido Cancelado',
		en: 'Request Cancelled'
	},
	email_cancelled_intro: {
		'pt-PT': 'Um cliente cancelou o seu pedido de serviço.',
		en: 'A client has cancelled their service request.'
	},
	email_cancelled_client_label: {
		'pt-PT': 'Cliente:',
		en: 'Client:'
	},
	email_cancelled_button: {
		'pt-PT': 'Ver Painel',
		en: 'View Dashboard'
	},

	// daily_summary template (courier receives daily summary)
	email_daily_summary_subject: {
		'pt-PT': 'Resumo Diário - {date}',
		en: 'Daily Summary - {date}'
	},
	email_daily_summary_title: {
		'pt-PT': 'O Seu Resumo Diário',
		en: 'Your Daily Summary'
	},
	email_daily_summary_intro: {
		'pt-PT': 'Aqui está o resumo dos seus serviços para hoje:',
		en: 'Here\'s your service summary for today:'
	},
	email_daily_summary_total_label: {
		'pt-PT': 'Total de Serviços:',
		en: 'Total Services:'
	},
	email_daily_summary_pending_label: {
		'pt-PT': 'Pendentes:',
		en: 'Pending:'
	},
	email_daily_summary_delivered_label: {
		'pt-PT': 'Entregues:',
		en: 'Delivered:'
	},
	email_daily_summary_urgent_label: {
		'pt-PT': 'Urgentes:',
		en: 'Urgent:'
	},
	email_daily_summary_no_services: {
		'pt-PT': 'Não tem serviços agendados para hoje.',
		en: 'You have no services scheduled for today.'
	},
	email_daily_summary_button: {
		'pt-PT': 'Ver Painel',
		en: 'View Dashboard'
	},

	// past_due template (courier receives past due alert)
	email_past_due_subject: {
		'pt-PT': 'Aviso: Serviço em Atraso',
		en: 'Alert: Overdue Service'
	},
	email_past_due_title: {
		'pt-PT': 'Serviço em Atraso',
		en: 'Overdue Service'
	},
	email_past_due_intro: {
		'pt-PT': 'O seguinte serviço está em atraso e requer a sua atenção:',
		en: 'The following service is overdue and requires your attention:'
	},
	email_past_due_client_label: {
		'pt-PT': 'Cliente:',
		en: 'Client:'
	},
	email_past_due_scheduled_label: {
		'pt-PT': 'Agendado:',
		en: 'Scheduled:'
	},
	email_past_due_days_overdue_label: {
		'pt-PT': 'Dias em Atraso:',
		en: 'Days Overdue:'
	},
	email_past_due_button: {
		'pt-PT': 'Ver Serviço',
		en: 'View Service'
	},

	// suggestion_accepted template (courier receives when client accepts)
	email_suggestion_accepted_subject: {
		'pt-PT': 'Sugestão de Data Aceite',
		en: 'Date Suggestion Accepted'
	},
	email_suggestion_accepted_title: {
		'pt-PT': 'Sugestão Aceite',
		en: 'Suggestion Accepted'
	},
	email_suggestion_accepted_intro: {
		'pt-PT': 'O cliente <strong>{client_name}</strong> aceitou a sua sugestão de data.',
		en: 'Client <strong>{client_name}</strong> has accepted your suggested date.'
	},
	email_suggestion_accepted_new_date_label: {
		'pt-PT': 'Data Confirmada:',
		en: 'Confirmed Date:'
	},
	email_suggestion_accepted_button: {
		'pt-PT': 'Ver Serviço',
		en: 'View Service'
	},

	// suggestion_declined template (courier receives when client declines)
	email_suggestion_declined_subject: {
		'pt-PT': 'Sugestão de Data Recusada',
		en: 'Date Suggestion Declined'
	},
	email_suggestion_declined_title: {
		'pt-PT': 'Sugestão Recusada',
		en: 'Suggestion Declined'
	},
	email_suggestion_declined_intro: {
		'pt-PT': 'O cliente <strong>{client_name}</strong> recusou a sua sugestão de data.',
		en: 'Client <strong>{client_name}</strong> has declined your suggested date.'
	},
	email_suggestion_declined_reason_label: {
		'pt-PT': 'Motivo:',
		en: 'Reason:'
	},
	email_suggestion_declined_original_date_label: {
		'pt-PT': 'Data Original Mantida:',
		en: 'Original Date Kept:'
	},
	email_suggestion_declined_cta: {
		'pt-PT': 'O serviço está novamente pendente para revisão.',
		en: 'The service is pending again for your review.'
	},
	email_suggestion_declined_button: {
		'pt-PT': 'Ver Serviço',
		en: 'View Service'
	},

	// Default/fallback template
	email_default_subject: {
		'pt-PT': 'Notificação bareCourier',
		en: 'bareCourier Notification'
	},
	email_default_title: {
		'pt-PT': 'Notificação',
		en: 'Notification'
	},
	email_default_message: {
		'pt-PT': 'Tem uma nova notificação do bareCourier.',
		en: 'You have a new notification from bareCourier.'
	}
};

export function emailT(
	key: string,
	locale: SupportedLocale,
	params?: TranslationParams
): string {
	const translation = emailTranslations[key];
	if (!translation) {
		console.warn(`Missing email translation: ${key}`);
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
