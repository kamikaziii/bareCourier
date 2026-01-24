<script lang="ts">
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend,
		type ChartData,
		type ChartOptions
	} from 'chart.js';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

	let {
		data,
		options = {},
		height = '300px'
	}: {
		data: ChartData<'bar'>;
		options?: ChartOptions<'bar'>;
		height?: string;
	} = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let chart: Chart<'bar'> | null = $state(null);

	$effect(() => {
		if (!canvas) return;

		chart = new Chart(canvas, {
			type: 'bar',
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
