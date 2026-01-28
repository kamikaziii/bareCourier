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
