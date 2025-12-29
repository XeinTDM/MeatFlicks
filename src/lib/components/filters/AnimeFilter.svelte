<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Select,
		SelectContent,
		SelectGroup,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select/index';

	let { value = 'include' }: { value?: 'include' | 'exclude' | 'only' } = $props();

	const updateUrl = (selectedValue: 'include' | 'exclude' | 'only') => {
		const newUrl = new URL($page.url);
		if (selectedValue === 'include') {
			newUrl.searchParams.delete('include_anime');
		} else {
			newUrl.searchParams.set('include_anime', selectedValue);
		}
		goto(newUrl.pathname + newUrl.search, { keepData: true, noScroll: true });
	};
</script>

<div>
	<label for="anime-filter" class="mb-2 block text-sm font-medium text-gray-300">Anime</label>
	<Select
		name="anime-filter"
		{value}
		onValueChange={(e) => {
			if (e) {
				updateUrl(e.value);
			}
		}}
	>
		<SelectTrigger class="w-full">
			<SelectValue placeholder="Filter anime" />
		</SelectTrigger>
		<SelectContent>
			<SelectGroup>
				<SelectItem value="include">With Anime</SelectItem>
				<SelectItem value="exclude">Without Anime</SelectItem>
				<SelectItem value="only">Anime Only</SelectItem>
			</SelectGroup>
		</SelectContent>
	</Select>
</div>
