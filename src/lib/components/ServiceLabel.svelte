<script lang="ts">
	import QRCode from 'qrcode';
	import { formatDate, formatTimeSlot } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { Service } from '$lib/database.types.js';

	interface ServiceLabelProps {
		service: Service;
		courierProfile: {
			name: string;
			phone?: string | null;
			label_business_name?: string | null;
			label_tagline?: string | null;
		};
		clientName: string;
	}

	let { service, courierProfile, clientName }: ServiceLabelProps = $props();

	let qrDataUrl = $state('');

	const businessName = $derived(courierProfile.label_business_name || courierProfile.name);
	const tagline = $derived(courierProfile.label_tagline);
	// Strip the # from display_id for URL (server route handles both formats)
	const displayIdForUrl = $derived(service.display_id?.replace('#', '') || '');
	const trackingUrl = $derived(
		typeof window !== 'undefined'
			? `${window.location.origin}/track/${displayIdForUrl}`
			: `/track/${displayIdForUrl}`
	);

	$effect(() => {
		generateQR();
	});

	async function generateQR() {
		try {
			qrDataUrl = await QRCode.toDataURL(trackingUrl, {
				width: 100,
				margin: 1,
				errorCorrectionLevel: 'M'
			});
		} catch (err) {
			console.error('QR generation failed:', err);
		}
	}
</script>

<div class="service-label">
	<!-- Header: Courier Branding -->
	<div class="label-header">
		<div class="business-name">{businessName}</div>
		{#if tagline}
			<div class="tagline">{tagline}</div>
		{/if}
		{#if courierProfile.phone}
			<div class="phone">{courierProfile.phone}</div>
		{/if}
	</div>

	<!-- Service Info -->
	<div class="label-service-info">
		<div class="display-id">{service.display_id}</div>
		<div class="service-badge">
			{m.label_delivery()}
		</div>
		{#if service.scheduled_date}
			<div class="schedule">
				{formatDate(service.scheduled_date)}
				{#if service.scheduled_time_slot}
					· {service.scheduled_time_slot === 'specific' && service.scheduled_time
						? service.scheduled_time
						: formatTimeSlot(service.scheduled_time_slot)}
				{/if}
			</div>
		{/if}
	</div>

	<!-- From Address -->
	<div class="label-address from">
		<div class="address-label">{m.label_from()}:</div>
		<div class="address-name">{clientName}</div>
		<div class="address-text">{service.pickup_location}</div>
	</div>

	<!-- To Address -->
	<div class="label-address to">
		<div class="address-label">{m.label_to()}:</div>
		{#if service.recipient_name}
			<div class="address-name">{service.recipient_name}</div>
		{/if}
		<div class="address-text">{service.delivery_location}</div>
		{#if service.recipient_phone}
			<div class="address-phone">Tel: {service.recipient_phone}</div>
		{/if}
	</div>

	<!-- Notes -->
	{#if service.notes}
		<div class="label-notes">
			{service.notes}
		</div>
	{/if}

	<!-- QR Code -->
	<div class="label-qr">
		{#if qrDataUrl}
			<img src={qrDataUrl} alt="QR Code" class="qr-image" />
		{/if}
		<div class="qr-info">
			<div class="qr-id">{service.display_id}</div>
			<div class="qr-hint">{m.label_scan_to_track()}</div>
		</div>
	</div>
</div>

<style>
	.service-label {
		width: 100mm;
		min-height: 150mm;
		padding: 4mm;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 10pt;
		background: white;
		color: black;
		border: 1px solid #ccc;
	}

	.label-header {
		text-align: center;
		padding-bottom: 3mm;
		border-bottom: 1px solid #333;
		margin-bottom: 3mm;
	}

	.business-name {
		font-size: 14pt;
		font-weight: bold;
	}

	.tagline {
		font-size: 9pt;
		color: #555;
	}

	.phone {
		font-size: 9pt;
	}

	.label-service-info {
		display: flex;
		align-items: center;
		gap: 3mm;
		padding: 2mm 0;
		border-bottom: 1px solid #ddd;
		margin-bottom: 3mm;
	}

	.display-id {
		font-family: monospace;
		font-size: 12pt;
		font-weight: bold;
	}

	.service-badge {
		background: #333;
		color: white;
		padding: 1mm 2mm;
		font-size: 8pt;
		font-weight: bold;
		border-radius: 2px;
	}

	.schedule {
		font-size: 9pt;
		color: #555;
	}

	.label-address {
		padding: 2mm 0;
		border-bottom: 1px solid #eee;
	}

	.label-address.to {
		border-bottom: 1px solid #ddd;
	}

	.address-label {
		font-size: 8pt;
		font-weight: bold;
		color: #666;
	}

	.address-name {
		font-size: 11pt;
		font-weight: bold;
	}

	.address-text {
		font-size: 10pt;
	}

	.address-phone {
		font-size: 9pt;
		color: #555;
	}

	.label-notes {
		padding: 2mm 0;
		font-size: 9pt;
		font-style: italic;
		border-bottom: 1px solid #ddd;
	}

	.label-qr {
		display: flex;
		align-items: center;
		gap: 3mm;
		padding-top: 3mm;
	}

	.qr-image {
		width: 25mm;
		height: 25mm;
	}

	.qr-info {
		flex: 1;
	}

	.qr-id {
		font-family: monospace;
		font-size: 11pt;
		font-weight: bold;
	}

	.qr-hint {
		font-size: 8pt;
		color: #666;
	}
</style>
