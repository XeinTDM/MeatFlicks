<script lang="ts">
  import { onMount } from 'svelte';
  import { faBars, faTimes, faSearch, faCog } from '@fortawesome/free-solid-svg-icons';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import { theme } from '$lib/state/stores/themeStore';
  import { page } from '$app/stores';
  import { signIn, signOut } from '@auth/sveltekit/client';

  let isNavOpen = false;
  let isSettingsOpen = false;
  let settingsRef: HTMLDivElement;

  $: session = $page.data.session;
  $: status = session ? 'authenticated' : 'unauthenticated';

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef && !settingsRef.contains(event.target as Node)) {
        isSettingsOpen = false;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    theme.set(newTheme);
  };
</script>

<header
  id="header"
  class={`bg-bg-color-alt shadow-shadow-color fixed top-0 left-0 z-[100] w-full shadow-lg transition-colors duration-400`}
>
  <div class="flex h-14 items-center justify-between px-6">
    <a href="/" class="text-2xl font-bold tracking-tighter text-text-color">
      Prism
    </a>
    <button
      class="cursor-pointer text-2xl text-text-color md:hidden"
      on:click={() => (isNavOpen = true)}
      aria-label="Open navigation menu"
    >
      <FontAwesomeIcon icon={faBars} />
    </button>

    <nav
      class={`fixed top-0 ${isNavOpen ? 'right-0' : '-right-full'} bg-bg-color z-[101] h-full w-full p-8 transition-all duration-400 md:static md:h-auto md:w-auto md:bg-transparent md:p-0`}
    >
      <div class="flex h-full flex-col md:flex-row md:items-center">
        <a href="/" class="mb-8 text-3xl font-bold text-text-color md:hidden">
          Prism
        </a>
        <button
          class="absolute top-5 right-5 cursor-pointer text-3xl text-text-color md:hidden"
          on:click={() => (isNavOpen = false)}
          aria-label="Close navigation menu"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
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
          {#if status === 'authenticated'}
            <li>
              <a
                href="/my-list"
                class="text-text-color hover:text-primary-color font-medium transition-colors duration-300 cursor-pointer"
              >
                My List
              </a>
            </li>
          {/if}
        </ul>
      </div>
    </nav>

    <div class="flex items-center gap-4">
      <a
        href="/search"
        class="bg-bg-color-alt border-border-color hover:bg-primary-color hover:border-primary-color flex items-center gap-2 rounded-md border px-4 py-2 font-medium text-text-color transition-all duration-300 hover:text-text-color md:px-4 md:py-2"
        aria-label="Search"
      >
        <FontAwesomeIcon icon={faSearch} />
        <span class="hidden md:inline">Search</span>
      </a>
      {#if status === 'authenticated'}
        <button
          on:click={() => signOut()}
          class="rounded-md bg-red-600 px-4 py-2 font-medium text-text-color transition-all duration-300 hover:bg-red-700"
          aria-label="Sign out"
        >
          Sign Out
        </button>
      {:else}
        <button
          on:click={() => signIn()}
          class="bg-primary-color hover:bg-primary-color-dark cursor-pointer rounded-md px-4 py-2 font-medium text-text-color transition-all duration-300"
          aria-label="Sign in"
        >
          Sign In
        </button>
      {/if}
      <div class="settings-menu relative">
        <button
          id="settings-toggle-btn"
          class="hover:bg-bg-color-alt flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent p-2 text-xl text-text-color transition-colors duration-300"
          on:click={() => (isSettingsOpen = !isSettingsOpen)}
          aria-expanded={isSettingsOpen}
          aria-controls="settings-dropdown"
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
        <div
          id="settings-dropdown"
          bind:this={settingsRef}
          class={`bg-bg-color-alt border-border-color shadow-shadow-color absolute top-[calc(100%+10px)] right-0 z-[110] w-[220px] rounded-lg border p-2 shadow-lg transition-all duration-300 ${isSettingsOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}>
          <div class="border-border-color border-b p-3 last:border-b-0">
            <h4 class="text-text-color mb-3 text-xs font-semibold tracking-wider uppercase">
              Theme
            </h4>
            <div class="bg-bg-color border-border-color flex rounded-md border p-0.5">
              <button
                class={`flex-1 rounded-md p-2 text-xs font-medium transition-all duration-300 hover:bg-primary-color-dark ${$theme === 'dark' ? 'bg-primary-color text-white' : 'text-white'}`}
                on:click={() => handleThemeChange('dark')}
              >
                Dark
              </button>
              <button
                class={`flex-1 rounded-md p-2 text-xs font-medium transition-all duration-300 hover:bg-primary-color-dark ${$theme === 'light' ? 'bg-primary-color text-white' : 'text-white'}`}
                on:click={() => handleThemeChange('light')}
              >
                Light
              </button>
            </div>
          </div>
          <div class="p-3 last:border-b-0">
            <h4 class="text-text-color mb-3 text-xs font-semibold tracking-wider uppercase">
              Language
            </h4>
            <select
              id="language-selector"
              class="bg-bg-color text-text-color border-border-color font-inherit w-full rounded-md border p-2"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>

