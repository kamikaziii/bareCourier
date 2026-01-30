<script lang="ts">
	import { navigating } from '$app/state';

	// Track progress state
	let progress = $state(0);
	let isVisible = $state(false);
	let animationFrame: number | undefined = $state();
	let hideTimeout: ReturnType<typeof setTimeout> | undefined = $state();

	// Watch navigation state changes
	$effect(() => {
		if (navigating) {
			// Start loading
			isVisible = true;
			progress = 0;

			// Animate progress to 90% over ~500ms
			const startTime = Date.now();
			const duration = 500;
			const targetProgress = 90;

			const animate = () => {
				const elapsed = Date.now() - startTime;
				const progressPercent = Math.min((elapsed / duration) * targetProgress, targetProgress);
				progress = progressPercent;

				if (progressPercent < targetProgress) {
					animationFrame = requestAnimationFrame(animate);
				}
			};

			animationFrame = requestAnimationFrame(animate);
		} else if (isVisible) {
			// Navigation complete - jump to 100%
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}

			progress = 100;

			// Hide after transition completes
			hideTimeout = setTimeout(() => {
				isVisible = false;
				progress = 0;
			}, 200);
		}

		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
			if (hideTimeout) {
				clearTimeout(hideTimeout);
			}
		};
	});
</script>

<div
	class="fixed top-0 left-0 right-0 z-[9999] h-1 pointer-events-none transition-opacity duration-200"
	class:opacity-0={!isVisible}
	class:opacity-100={isVisible}
	role="progressbar"
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(progress)}
	aria-label="Page loading"
>
	<div
		class="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
		style="width: {progress}%;"
	></div>
</div>
