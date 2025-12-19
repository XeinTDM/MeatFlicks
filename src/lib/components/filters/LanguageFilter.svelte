<script lang="ts">
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';
	import { Button } from '$lib/components/ui/button';
	import { Globe, X } from '@lucide/svelte';
	import { LANGUAGE_OPTIONS } from '$lib/types/filters';

	interface Props {
		language?: string;
		onLanguageChange: (language: string | undefined) => void;
	}

	let { language, onLanguageChange }: Props = $props();

	function handleLanguageChange(value: string | undefined) {
		onLanguageChange(value);
	}

	function clearLanguage() {
		onLanguageChange(undefined);
	}

	let selectedLanguageName = $derived(() => {
		if (!language) return null;
		const lang = LANGUAGE_OPTIONS.find((l) => l.code === language);
		return lang?.name || language;
	});
</script>

<div class="space-y-3">
	<!-- Current selection -->
	{#if language}
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Globe class="h-4 w-4 text-muted-foreground" />
				<span class="text-sm font-medium">{selectedLanguageName()}</span>
			</div>
			<Button variant="ghost" size="sm" onclick={clearLanguage} class="h-7 text-xs">
				<X class="mr-1 h-3 w-3" />
				Clear
			</Button>
		</div>
	{/if}

	<!-- Language selector -->
	<Select value={language} onValueChange={handleLanguageChange}>
		<SelectTrigger class="w-full">
			<SelectValue placeholder="Select language" />
		</SelectTrigger>
		<SelectContent>
			{#each LANGUAGE_OPTIONS as lang}
				<SelectItem value={lang.code}>
					{lang.name}
				</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>
