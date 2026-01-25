<script lang="ts">
	import { untrack } from 'svelte';
	import {
		Chart,
		// Controllers
		BarController,
		LineController,
		DoughnutController,
		// Elements
		BarElement,
		LineElement,
		PointElement,
		ArcElement,
		// Scales
		CategoryScale,
		LinearScale,
		// Plugins
		Title,
		Tooltip,
		Legend,
		Filler,
		type ChartData,
		type ChartOptions,
		type ChartType
	} from 'chart.js';

	// Register all components once
	Chart.register(
		BarController,
		LineController,
		DoughnutController,
		BarElement,
		LineElement,
		PointElement,
		ArcElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend,
		Filler
	);

	let {
		type,
		data,
		options = {},
		height = '300px'
	}: {
		type: ChartType;
		data: ChartData;
		options?: ChartOptions;
		height?: string;
	} = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let chart: Chart | null = $state(null);

	// Create chart when canvas is available or type changes
	// Use untrack for data/options so changes don't trigger chart recreation
	$effect(() => {
		if (!canvas) return;

		// Read data and options without tracking them as dependencies
		const initialData = untrack(() => data);
		const initialOptions = untrack(() => options);

		chart = new Chart(canvas, {
			type,
			data: initialData,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				...initialOptions
			}
		});

		return () => {
			chart?.destroy();
		};
	});

	// Update chart data efficiently when it changes (without recreating chart)
	$effect(() => {
		if (chart && data) {
			chart.data = data;
			chart.update();
		}
	});

	// Update chart options when they change
	$effect(() => {
		if (chart && options) {
			chart.options = {
				responsive: true,
				maintainAspectRatio: false,
				...options
			};
			chart.update();
		}
	});
</script>

<div style="height: {height}">
	<canvas bind:this={canvas}></canvas>
</div>
