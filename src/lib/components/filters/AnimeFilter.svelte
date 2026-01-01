<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		Select,
		SelectContent,
		SelectGroup,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index';

	let { value = 'include' }: { value?: 'include' | 'exclude' | 'only' } = $props();

	const updateUrl = async (selectedValue: 'include' | 'exclude' | 'only') => {
		const newUrl = new URL(page.url);
		if (selectedValue === 'include') {
			newUrl.searchParams.delete('include_anime');
		} else {
			newUrl.searchParams.set('include_anime', selectedValue);
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(newUrl.pathname + newUrl.search, { noScroll: true });
	};
</script>

<div>
	<label for="anime-filter" class="mb-2 block text-sm font-medium text-gray-300">Anime</label>
	<Select
		name="anime-filter"
		{value}
		type="single"
		onValueChange={(value) => updateUrl(value as 'include' | 'exclude' | 'only')}
	>
		<SelectTrigger class="w-full" placeholder="Filter anime" />
		<SelectContent>
			<SelectGroup>
				<SelectItem value="include">With Anime</SelectItem>
				<SelectItem value="exclude">Without Anime</SelectItem>
				<SelectItem value="only">Anime Only</SelectItem>
			</SelectGroup>
		</SelectContent>
	</Select>
</div>
