<script lang="ts">
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

	$effect(() => {
		if (!canvas) return;

		chart = new Chart(canvas, {
			type,
			data,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				...options
			}
		});

		return () => {
			chart?.destroy();
		};
	});

	// Update chart data when it changes
	$effect(() => {
		if (chart && data) {
			chart.data = data;
			chart.update();
		}
	});
</script>

<div style="height: {height}">
	<canvas bind:this={canvas}></canvas>
</div>
