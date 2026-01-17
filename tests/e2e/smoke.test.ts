import { test, expect } from '@playwright/test';

test('smoke test: homepage loads and navigation to playback works', async ({ page }) => {
	console.log('Step 1: Navigating to homepage...');
	// Using 'commit' to resolve navigation as soon as response headers are received.
	// This prevents hanging if some assets (like large images or background fetches) are slow.
	await page.goto('/', { waitUntil: 'commit', timeout: 60000 });
	console.log('Navigation committed.');

	// 2. Expect page title to contain "MeatFlicks"
	await expect(page).toHaveTitle(/MeatFlicks/);
	console.log('Title verified.');

	// 3. Wait for content to load
	// We look for either the Hero Play button OR the "Stay tuned" message (empty library)
	const heroPlayButton = page.getByRole('link', { name: 'Play' }).first();
	const stayTuned = page.getByText('Stay tuned');

	console.log('Step 3: Waiting for content or empty state...');

	let foundContent = false;
	for (let attempt = 1; attempt <= 3; attempt++) {
		console.log(`Checking page content (attempt ${attempt}/3)...`);

		// Wait for one of the target elements to appear
		const result = await Promise.race([
			heroPlayButton.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'content'),
			stayTuned.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'empty'),
			page.waitForTimeout(35000).then(() => 'timeout')
		]);

		if (result === 'content') {
			foundContent = true;
			break;
		}

		if (result === 'empty') {
			console.log(
				'Library is empty. Background priming might be active. Waiting 15s before reload...'
			);
			await page.waitForTimeout(15000);
			await page.reload({ waitUntil: 'commit' });
			continue;
		}

		if (result === 'timeout') {
			console.log('Neither Play button nor Stay Tuned found. Reloading...');
			await page.reload({ waitUntil: 'commit' });
		}
	}

	if (!foundContent) {
		// Final check
		if (await stayTuned.isVisible()) {
			throw new Error(
				'Smoke test failed: Library remains empty after multiple reloads. Priming might be failing or taking too long.'
			);
		}
		await expect(heroPlayButton).toBeVisible({ timeout: 10000 });
	}

	console.log('Hero Play button is visible.');

	// Get the title from the Hero section to verify later
	const heroTitleElement = page.locator('.text-4xl.font-bold, h1, h3').first();
	const movieTitle = await heroTitleElement.innerText();
	console.log(`Testing with movie: ${movieTitle}`);

	// 4. Click the "Play" button in the Hero section
	await heroPlayButton.click();
	console.log('Clicked Play button.');

	// 5. Verify navigation to details page
	// Support both TMDB numeric IDs and IMDb IDs (e.g. tt0111161)
	await expect(page).toHaveURL(/\/movie\/(?:\d+|tt\d+)|\/tv\/(?:\d+|tt\d+)/, { timeout: 20000 });
	console.log('Navigated to details page.');

	// 6. Verify we are on the details page
	const titleHeading = page.getByRole('heading', { name: movieTitle }).first();
	const titleImage = page.getByAltText(movieTitle).first();

	await expect(titleHeading.or(titleImage).first()).toBeVisible({ timeout: 20000 });
	console.log('Details page title verified.');

	// 7. Check for the Play button on the details page (MediaHeader)
	const detailsPlayButton = page.getByRole('button', { name: 'Play' }).first();
	await expect(detailsPlayButton).toBeVisible({ timeout: 20000 });
	console.log('Details Play button verified. Test passed!');
});
