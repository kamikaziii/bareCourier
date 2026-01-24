<script lang="ts">
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend,
		Filler,
		type ChartData,
		type ChartOptions
	} from 'chart.js';

	Chart.register(
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend,
		Filler
	);

	let {
		data,
		options = {},
		height = '300px'
	}: {
		data: ChartData<'line'>;
		options?: ChartOptions<'line'>;
		height?: string;
	} = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let chart: Chart<'line'> | null = $state(null);

	$effect(() => {
		if (!canvas) return;

		chart = new Chart(canvas, {
			type: 'line',
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
