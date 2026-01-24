<script lang="ts">
	import {
		Chart,
		DoughnutController,
		ArcElement,
		Tooltip,
		Legend,
		type ChartData,
		type ChartOptions
	} from 'chart.js';

	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	let {
		data,
		options = {},
		height = '300px'
	}: {
		data: ChartData<'doughnut'>;
		options?: ChartOptions<'doughnut'>;
		height?: string;
	} = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let chart: Chart<'doughnut'> | null = $state(null);

	$effect(() => {
		if (!canvas) return;

		chart = new Chart(canvas, {
			type: 'doughnut',
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
