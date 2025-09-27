<script lang="ts">
  import { ChevronRight } from '@lucide/svelte'
  import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious
  } from '$lib/components/ui/carousel'
  import MovieCard from './MovieCard.svelte'
  import type { LibraryMovie } from '$lib/types/library'

  let { title, movies, linkTo }: {
    title: string
    movies: LibraryMovie[]
    linkTo?: string
  } = $props()

  let moviesCount = $derived(() => movies?.length ?? 0)
  let hasMultipleMovies = $derived(() => moviesCount > 1)

  const carouselOpts = { align: "center" } as const
</script>

<div class="bg-bg-color px-[5%] py-8">
  {#if linkTo}
    <a
      href={linkTo}
      class="group mb-6 flex w-full items-center justify-center text-text-color transition-colors duration-300 hover:text-primary-color"
    >
      <h2 class="text-3xl font-semibold">{title}</h2>
      <div class="ml-2 flex items-center gap-1">
        <span class="w-0 overflow-hidden text-sm font-medium transition-all duration-300 group-hover:w-auto">
          See All
        </span>
        <ChevronRight class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </a>
  {:else}
    <div class="mb-6 flex w-full items-center justify-center">
      <h2 class="text-3xl font-semibold text-text-color">{title}</h2>
    </div>
  {/if}

  <Carousel class="relative w-full" opts={carouselOpts}>
    <CarouselContent class="pb-4">
      {#each movies as movie (movie.id)}
        <CarouselItem class="basis-auto pl-4">
          <div class="flex justify-center">
            <MovieCard {movie} />
          </div>
        </CarouselItem>
      {/each}
    </CarouselContent>
    {#if hasMultipleMovies}
      <CarouselPrevious class="hidden md:inline-flex" />
      <CarouselNext class="hidden md:inline-flex" />
    {/if}
  </Carousel>
</div>
