import { onMount } from 'svelte';

/**
 * Lazy loading utility for Svelte components
 * @param importFn Dynamic import function for the component
 * @returns Promise that resolves to the component
 */
export function lazyLoadComponent<T = any>(importFn: () => Promise<{ default: T }>): Promise<T> {
	return importFn().then(module => module.default);
}

/**
 * Hook for lazy loading components with loading state
 * @param importFn Dynamic import function for the component
 * @returns Object with component and loading state
 */
export function useLazyComponent<T = any>(importFn: () => Promise<{ default: T }>) {
	let component: T | null = $state(null);
	let isLoading = $state(true);
	let error: Error | null = $state(null);

	onMount(async () => {
		try {
			component = await lazyLoadComponent(importFn);
			isLoading = false;
		} catch (err) {
			error = err as Error;
			isLoading = false;
			console.error('Failed to lazy load component:', err);
		}
	});

	return {
		get component() { return component; },
		get isLoading() { return isLoading; },
		get error() { return error; }
	};
}

/**
 * Intersection Observer hook for lazy loading when element comes into view
 * @param elementRef Reference to the element to observe (reactive)
 * @param importFn Dynamic import function
 * @param options IntersectionObserver options
 * @returns Object with component and loading state
 */
export function useLazyComponentOnVisible<T = any>(
	elementRef: { value: HTMLElement | null },
	importFn: () => Promise<{ default: T }>,
	options: IntersectionObserverInit = { threshold: 0.1 }
) {
	let component: T | null = $state(null);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let error: Error | null = $state(null);

	$effect(() => {
		const element = elementRef.value;
		if (!element || hasLoaded) return;

		const observer = new IntersectionObserver((entries) => {
			const [entry] = entries;
			if (entry.isIntersecting && !hasLoaded && !isLoading) {
				isLoading = true;
				lazyLoadComponent(importFn)
					.then((comp) => {
						component = comp;
						hasLoaded = true;
						isLoading = false;
					})
					.catch((err) => {
						error = err as Error;
						isLoading = false;
						console.error('Failed to lazy load component:', err);
					});

				observer.disconnect();
			}
		}, options);

		observer.observe(element);

		return () => observer.disconnect();
	});

	return {
		get component() { return component; },
		get isLoading() { return isLoading; },
		get hasLoaded() { return hasLoaded; },
		get error() { return error; }
	};
}
