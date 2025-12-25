import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('should import without errors', () => {
		expect(Page).toBeDefined();
	});
});
