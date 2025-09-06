<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  const { movie } = data;

  $: releaseYear = movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A';
</script>

{#if !movie}
  <div class="flex min-h-screen flex-col items-center justify-center text-text-color">
    <h1 class="text-4xl font-bold">Movie Not Found</h1>
    <p class="text-lg">The movie you are looking for does not exist.</p>
  </div>
{:else}
  <div class="min-h-screen bg-bg-color text-text-color">
    <main class="container mx-auto p-4">
      <div class="relative mb-8 h-96 w-full">
        {#if movie.backdropPath}
          <img
            src={movie.backdropPath}
            alt={movie.title}
            class="rounded-lg object-cover w-full h-full"
          />
        {/if}
        <div class="absolute inset-0 rounded-lg bg-gradient-to-t from-black to-transparent"></div>
        <div class="absolute bottom-4 left-4">
          <h1 class="text-5xl font-bold text-text-color">{movie.title}</h1>
          <p class="text-xl text-gray-300">
            {releaseYear} | {movie.durationMinutes} min
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-8 md:flex-row">
        <div class="md:w-1/3 lg:w-1/4">
          {#if movie.posterPath}
            <img
              src={movie.posterPath}
              alt={movie.title}
              width="300"
              height="450"
              class="rounded-lg shadow-lg"
            />
          {/if}
        </div>
        <div class="md:w-2/3 lg:w-3/4">
          <h2 class="mb-4 text-3xl font-bold">Overview</h2>
          <p class="mb-4 text-lg text-gray-300">{movie.overview}</p>

          <div class="mb-4">
            <h3 class="text-2xl font-bold">Rating: {movie.rating?.toFixed(1)} / 10</h3>
          </div>

          <div class="mb-4">
            <h3 class="text-2xl font-bold">Genres:</h3>
            <p class="text-lg text-gray-300">
              {#if movie.genres && movie.genres.length > 0}
                {movie.genres.map((genre: any) => genre.name).join(', ')}
              {:else}
                N/A
              {/if}
            </p>
          </div>

          {#if movie.cast && movie.cast.length > 0}
            <div class="mb-4">
              <h3 class="text-2xl font-bold">Cast:</h3>
              <p class="text-lg text-gray-300">{movie.cast.map((actor: any) => actor.name).join(', ')}</p>
            </div>
          {/if}

          {#if movie.trailerUrl}
            <div class="mb-4">
              <h3 class="text-2xl font-bold">Trailer:</h3>
              <div class="flex aspect-video items-center justify-center rounded-lg bg-gray-800">
                <iframe
                  src={movie.trailerUrl}
                  title="Movie Trailer"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                  class="w-full h-full rounded-lg"
                ></iframe>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </main>
  </div>
{/if}
