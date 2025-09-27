<script lang="ts">
  import { onMount } from "svelte"
  import { Menu, X, Search, Cog, Sun, Moon, Download, Upload } from "@lucide/svelte"
  import { toggleMode } from "mode-watcher"
  import { Button } from "$lib/components/ui/button"
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select"
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs"
  import { Input } from "$lib/components/ui/input"
  import { watchlist } from "$lib/state/stores/watchlistStore"
  import { watchHistory } from "$lib/state/stores/historyStore"
  import type { Movie } from "$lib/state/stores/watchlistStore"
  import type { HistoryEntry } from "$lib/state/stores/historyStore"

  type DataNotice = { text: string; tone: "success" | "error" }

  let isNavOpen = $state(false)
  let isSettingsOpen = $state(false)
  let settingsRef: HTMLDivElement
  let importInput: HTMLInputElement | null = null
  let settingsTab = $state<"preferences" | "data">("preferences")
  let dataNotice = $state<DataNotice | null>(null)

  let watchlistCount = $derived(() => watchlist.watchlist?.length ?? 0)
  let historyCount = $derived(() => watchHistory.entries?.length ?? 0)

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef && !settingsRef.contains(event.target as Node)) {
        const toggleButton = (event.target as HTMLElement)?.closest("#settings-toggle-btn")
        if (!toggleButton) {
          isSettingsOpen = false
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  })

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" }
  ]

  let selectedLanguage = $state(languageOptions[0].value)

  const handleExport = () => {
    try {
      const payload = {
        version: 1,
        generatedAt: new Date().toISOString(),
        watchlist: watchlist.exportData(),
        history: watchHistory.exportData()
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "meatflicks-data.json"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      dataNotice = { text: "Data exported successfully.", tone: "success" }
    } catch (error) {
      console.error("Failed to export data:", error)
      dataNotice = { text: "Failed to export data. Please try again.", tone: "error" }
    }
  }

  const triggerImport = () => {
    dataNotice = null
    importInput?.click()
  }

  const handleImport = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]

    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Record<string, unknown>

      if ("watchlist" in parsed && Array.isArray(parsed.watchlist)) {
        watchlist.replaceAll(parsed.watchlist as Movie[])
      }

      if ("history" in parsed && Array.isArray(parsed.history)) {
        watchHistory.replaceAll(parsed.history as HistoryEntry[])
      }

      dataNotice = { text: "Data imported successfully.", tone: "success" }
    } catch (error) {
      console.error("Failed to import data:", error)
      dataNotice = { text: "Failed to import data. Ensure the file is valid JSON.", tone: "error" }
    } finally {
      input.value = ""
    }
  }
</script>

<header
  id="header"
  class={`bg-bg-color-alt shadow-shadow-color fixed top-0 left-0 z-[100] w-full shadow-lg transition-colors duration-400`}
>
  <div class="flex h-14 items-center justify-between px-6">
    <a href="/" class="text-2xl font-bold tracking-tighter text-text-color">
      MeatFlicks
    </a>
    <Button
      variant="ghost"
      size="icon"
      class="text-text-color md:hidden"
      onclick={() => (isNavOpen = true)}
      aria-label="Open navigation menu"
    >
      <Menu class="w-4 h-4" />
    </Button>

    <nav
      class={`fixed top-0 ${isNavOpen ? 'right-0' : '-right-full'} bg-bg-color z-[101] h-full w-full p-8 transition-all duration-400 md:static md:h-auto md:w-auto md:bg-transparent md:p-0`}
    >
      <div class="flex h-full flex-col md:flex-row md:items-center">
        <a href="/" class="mb-8 text-3xl font-bold text-text-color md:hidden">
          MeatFlicks
        </a>
        <Button
          variant="ghost"
          size="icon"
          class="absolute top-5 right-5 text-text-color md:hidden"
          onclick={() => (isNavOpen = false)}
          aria-label="Close navigation menu"
        >
          <X class="w-4 h-4" />
        </Button>
        <ul class="flex flex-col gap-8 md:ml-auto md:flex-row md:gap-10">
          <li>
            <a
              href="/"
              class="hover:text-primary-color font-medium text-text-color transition-colors duration-300"
            >
              Home
            </a>
          </li>
          <li>
            <a
              href="/category/tv-shows"
              class="hover:text-primary-color font-medium text-text-color transition-colors duration-300"
            >
              TV Shows
            </a>
          </li>
          <li>
            <a
              href="/category/movies"
              class="hover:text-primary-color font-medium text-text-color transition-colors duration-300"
            >
              Movies
            </a>
          </li>
          <li>
            <a
              href="/my-list"
              class="text-text-color hover:text-primary-color font-medium transition-colors duration-300 cursor-pointer"
            >
              My List
            </a>
          </li>
        </ul>
      </div>
    </nav>

    <div class="flex items-center gap-4">
      <Button
        href="/search"
        variant="outline"
        class="bg-bg-color-alt border-border-color text-text-color hover:bg-primary-color hover:border-primary-color hover:text-text-color md:px-4 md:py-2"
        aria-label="Search"
      >
        <Search class="w-4 h-4" />
        <span class="hidden md:inline">Search</span>
      </Button>
      <div class="settings-menu relative">
        <Button
          id="settings-toggle-btn"
          variant="ghost"
          size="icon"
          class="h-10 w-10 rounded-full text-text-color hover:bg-bg-color-alt"
          onclick={() => (isSettingsOpen = !isSettingsOpen)}
          aria-expanded={isSettingsOpen}
          aria-controls="settings-dropdown"
        >
          <Cog class="w-4 h-4" />
        </Button>
        <div
          id="settings-dropdown"
          bind:this={settingsRef}
          class={`bg-bg-color-alt border-border-color shadow-shadow-color absolute top-[calc(100%+10px)] right-0 z-[110] w-[260px] rounded-lg border p-3 shadow-lg transition-all duration-300 ${isSettingsOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}
        >
          <Tabs
            value={settingsTab}
            onValueChange={(value: string) => (settingsTab = value as 'preferences' | 'data')}
            class="w-full"
          >
            <TabsList class="grid w-full grid-cols-2 gap-1">
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
            </TabsList>

            <TabsContent value="preferences" class="mt-4 space-y-4">
              <section class="space-y-3">
                <h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
                  Theme
                </h4>
                <div class="bg-bg-color border-border-color flex rounded-md border p-0.5">
                  <Button onclick={toggleMode} variant="outline" size="icon" aria-label="Toggle theme">
                    <Sun
                      class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 !transition-all dark:-rotate-90 dark:scale-0"
                    />
                    <Moon
                      class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 !transition-all dark:rotate-0 dark:scale-100"
                    />
                    <span class="sr-only">Toggle theme</span>
                  </Button>
                </div>
              </section>

              <section class="space-y-3">
                <h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
                  Language
                </h4>
                <Select
                  type="single"
                  value={selectedLanguage}
                  onValueChange={(value) => (selectedLanguage = value)}
                >
                  <SelectTrigger class="w-full justify-between" aria-label="Select language">
                    <span class="text-sm font-medium">
                      {languageOptions.find((option) => option.value === selectedLanguage)?.label ?? 'Select'}
                    </span>
                  </SelectTrigger>
                  <SelectContent class="w-full">
                    {#each languageOptions as option (option.value)}
                      <SelectItem value={option.value}>{option.label}</SelectItem>
                    {/each}
                  </SelectContent>
                </Select>
              </section>
            </TabsContent>

            <TabsContent value="data" class="mt-4 space-y-4">
              <section class="space-y-2 text-sm text-text-color">
                <p class="text-xs uppercase tracking-wide text-muted-foreground">Stored Data</p>
                <div class="rounded-md border border-border-color bg-bg-color p-3">
                  <p>Watchlist items: {watchlistCount}</p>
                  <p>History entries: {historyCount}</p>
                </div>
              </section>

              <div class="flex flex-col gap-2">
                <Button variant="secondary" class="w-full justify-start gap-2" onclick={handleExport}>
                  <Download class="h-4 w-4" />
                  Export Data
                </Button>
                <Button variant="outline" class="w-full justify-start gap-2" onclick={triggerImport}>
                  <Upload class="h-4 w-4" />
                  Import Data
                </Button>
                <Input
                  bind:this={importInput}
                  type="file"
                  accept="application/json"
                  class="hidden"
                  onchange={handleImport}
                />
                {#if dataNotice}
                  <p class={`text-xs ${dataNotice.tone === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {dataNotice.text}
                  </p>
                {/if}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  </div>
</header>
