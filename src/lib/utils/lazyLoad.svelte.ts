import { onMount } from 'svelte';
import { writable } from 'svelte/store';

/**
 * Lazy loading utility for Svelte components
 * @param importFn Dynamic import function for the component
 * @returns Promise that resolves to the component
 */
export function lazyLoadComponent<T = any>(importFn: () => Promise<{ default: T }>): Promise<T> {
	return importFn().then((module) => module.default);
}

/**
 * Hook for lazy loading components with loading state
 * @param importFn Dynamic import function for the component
 * @returns Object with component and loading state
 */
export function useLazyComponent<T = any>(importFn: () => Promise<{ default: T }>) {
	const component = writable<T | null>(null);
	const isLoading = writable(true);
	const error = writable<Error | null>(null);

	onMount(async () => {
		try {
			const comp = await lazyLoadComponent(importFn);
			component.set(comp);
			isLoading.set(false);
		} catch (err) {
			error.set(err as Error);
			isLoading.set(false);
			console.error('Failed to lazy load component:', err);
		}
	});

	return {
		component,
		isLoading,
		error
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
	const component = writable<T | null>(null);
	const isLoading = writable(false);
	const hasLoaded = writable(false);
	const error = writable<Error | null>(null);

	// Use onMount to set up the observer on client side only
	onMount(() => {
		const element = elementRef.value;
		if (!element) return;

		let loaded = false;
		let loading = false;

		const observer = new IntersectionObserver((entries) => {
			const [entry] = entries;
			if (entry.isIntersecting && !loaded && !loading) {
				loading = true;
				isLoading.set(true);
				lazyLoadComponent(importFn)
					.then((comp) => {
						component.set(comp);
						hasLoaded.set(true);
						isLoading.set(false);
						loaded = true;
						loading = false;
					})
					.catch((err) => {
						error.set(err as Error);
						isLoading.set(false);
						loading = false;
						console.error('Failed to lazy load component:', err);
					});

				observer.disconnect();
			}
		}, options);

		observer.observe(element);

		return () => observer.disconnect();
	});

	return {
		component,
		isLoading,
		hasLoaded,
		error
	};
}
