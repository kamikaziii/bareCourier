/**
 * Print an HTML element in an isolated iframe
 * Industry-standard approach used by printd, react-to-print, etc.
 * @param element - The HTML element to print
 * @param title - Optional document title (used as PDF filename when saving)
 */
export function printElement(element: HTMLElement, title?: string): void {
	// Create hidden iframe
	const iframe = document.createElement('iframe');
	iframe.style.position = 'absolute';
	iframe.style.width = '0';
	iframe.style.height = '0';
	iframe.style.border = 'none';
	iframe.style.left = '-9999px';

	document.body.appendChild(iframe);

	const doc = iframe.contentDocument || iframe.contentWindow?.document;
	if (!doc) {
		document.body.removeChild(iframe);
		return;
	}

	// Write complete HTML document with label styles
	const documentTitle = title || 'Label';

	doc.open();
	doc.write(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>${documentTitle}</title>
			<style>
				@page {
					size: 100mm auto;
					margin: 0;
				}

				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}

				body {
					font-family: Arial, Helvetica, sans-serif;
					font-size: 10pt;
					background: white;
					color: black;
				}

				.service-label {
					width: 100mm;
					padding: 5mm;
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

				.tagline, .phone {
					font-size: 9pt;
					color: #555;
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
		</head>
		<body>
			${element.outerHTML}
		</body>
		</html>
	`);
	doc.close();

	// Wait for content to load (especially images like QR code), then print
	iframe.onload = () => {
		iframe.contentWindow?.focus();
		iframe.contentWindow?.print();

		// Clean up after print dialog closes
		setTimeout(() => {
			if (iframe.parentNode) {
				document.body.removeChild(iframe);
			}
		}, 1000);
	};

	// Fallback: trigger load manually for synchronous content
	if (iframe.contentDocument?.readyState === 'complete') {
		iframe.contentWindow?.focus();
		iframe.contentWindow?.print();
		setTimeout(() => {
			if (iframe.parentNode) {
				document.body.removeChild(iframe);
			}
		}, 1000);
	}
}
