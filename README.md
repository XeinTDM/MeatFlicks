# MeatFlicks

MeatFlicks is a SvelteKit 2 (Svelte 5 runes) web application for exploring and streaming movies and TV series. It stores a curated library in PostgreSQL via Prisma, augments records with TMDB metadata, resolves playable sources from multiple third-party streaming providers, and lets authenticated users maintain a personal watchlist.

## Features

- Server-rendered Svelte 5 experience with Tailwind CSS v4 styling and responsive design.
- Library ingestion backed by Prisma + PostgreSQL with TMDB enrichment (cast, trailers, artwork).
- Streaming resolver that queries Vidlink, Vidsrc, TwoEmbed, and EmbedSu, with provider prioritisation and diagnostics.
- OAuth authentication with GitHub and Google via @auth/sveltekit/NextAuth and JWT sessions.
- Personal watchlist controls backed by the Prisma database and exposed through `/api/watchlist`.
- Global search endpoint (`/api/search`) with debounced UI, category/collection browsing, and light/dark theme toggle.

## Tech Stack

- SvelteKit 2 / Svelte 5 runes mode / TypeScript (strict)
- Tailwind CSS v4 with utility-first design
- Bun for runtime, dependency management, and scripts
- Prisma ORM + PostgreSQL
- @auth/sveltekit (NextAuth) + Prisma adapter
- Zod validation for configuration, Font Awesome icons, Axios for outbound requests, Vitest/Playwright for testing

## Prerequisites

- Bun >= 1.1.0 (installs dependencies and runs scripts)
- Node.js >= 18 (Bun still relies on system Node toolchain for some utilities)
- Access to a PostgreSQL database instance
- TMDB API key
- OAuth credentials for GitHub (required) and optionally Google
- Secrets store or `.env` file containing the configuration below (never commit production secrets)

## Getting Started

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create a `.env` file (or configure your secrets manager) using the variables listed below.

3. Apply database migrations:

   ```bash
   bunx prisma migrate deploy
   # or bunx prisma migrate dev --name init for local development
   ```

4. (Optional) Inspect or edit data with Prisma Studio:

   ```bash
   bunx prisma studio
   ```

5. Start the development server:

   ```bash
   bun dev
   ```

   The app will be available on the host/port reported by Vite (default `http://localhost:5173`). Keep `NEXT_PUBLIC_BASE_URL` aligned with this URL.

## Environment Variables

### Core backend

| Variable                      | Description                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | PostgreSQL connection string used by Prisma in the request pipeline (pgbouncer-friendly in production). |
| `DIRECT_URL`                  | Direct PostgreSQL connection string used for Prisma migrations.                                         |
| `TMDB_API_KEY`                | Server-side TMDB API key for enriching movie records.                                                   |
| `TMDB_IMAGE_BASE_URL`         | TMDB CDN base URL (default `https://image.tmdb.org/t/p/`).                                              |
| `TMDB_POSTER_SIZE`            | Poster size path segment (e.g. `w500`).                                                                 |
| `TMDB_BACKDROP_SIZE`          | Backdrop size path segment (e.g. `original`).                                                           |
| `AUTH_SECRET`                 | Secret used by NextAuth JWT sessions.                                                                   |
| `NEXTAUTH_SECRET`             | Duplicate of `AUTH_SECRET` required by runtime config validation.                                       |
| `GITHUB_ID` / `GITHUB_SECRET` | OAuth client credentials for GitHub sign-in.                                                            |
| `GOOGLE_ID` / `GOOGLE_SECRET` | OAuth client credentials for Google sign-in (optional but supported).                                   |

### Client-facing

| Variable                                                          | Description                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BASE_URL`                                            | Absolute URL the browser should use when calling internal APIs (e.g. `http://localhost:5173`).          |
| `NEXT_PUBLIC_TMDB_API_KEY`                                        | Optional: overrides the public TMDB key exposed to the client; falls back to `TMDB_API_KEY` if omitted. |
| `NEXT_PUBLIC_TMDB_IMAGE_BASE_URL`                                 | Optional: overrides the image base URL exposed to the client; defaults to the server value.             |
| `NEXT_PUBLIC_TMDB_POSTER_SIZE` / `NEXT_PUBLIC_TMDB_BACKDROP_SIZE` | Optional poster/backdrop size overrides; default to server values.                                      |

### Streaming providers (optional overrides)

| Variable                               | Description                                                                |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `VIDLINK_BASE_URL` / `VIDLINK_API_KEY` | Base URL and key for Vidlink resolver (defaults to `https://vidlink.pro`). |
| `VIDSRC_BASE_URL` / `VIDSRC_API_KEY`   | Base URL and key for Vidsrc resolver (defaults to `https://vidsrc.me`).    |
| `EMBEDSU_BASE_URL`                     | Base URL for EmbedSu resolver (defaults to `https://embed.su`).            |
| `TWOEMBED_BASE_URL`                    | Base URL for TwoEmbed resolver (defaults to `https://www.2embed.to`).      |

Keep secrets out of version control and rotate credentials regularly.

## Commands

| Command                   | Description                                                       |
| ------------------------- | ----------------------------------------------------------------- |
| `bun dev`                 | Start the SvelteKit development server.                           |
| `bun run build`           | Create a production build.                                        |
| `bun preview`             | Preview the production build locally.                             |
| `bun run lint`            | Run Prettier check and ESLint.                                    |
| `bun run check`           | Run SvelteKit sync and type-checking (svelte-check + TypeScript). |
| `bun test`                | Execute Vitest unit tests (`--run` configured in package).        |
| `bunx prisma migrate dev` | Apply database migrations during development.                     |
| `bunx prisma studio`      | Open Prisma Studio for inspecting data.                           |

## Project Structure

```
prisma/                # Prisma schema, migrations, and local dev database
src/
  lib/
    components/        # Reusable Svelte components (hero, cards, header, etc.)
    config/            # Runtime environment and streaming provider configuration
    server/            # Prisma client, repositories, services, Auth config
    state/             # Svelte stores (theme, watchlist)
    streaming/         # Provider registry and resolution helpers
    utils/             # Shared utility helpers (slugs, etc.)
routes/
  (app)/               # UI routes (home, movie detail, collections, search, watchlist)
  api/                 # JSON APIs (movies, genres, search, streaming, watchlist, auth)
hooks.server.ts        # NextAuth (@auth/sveltekit) integration
static/                # Static assets served as-is
tailwind.config.ts     # Tailwind CSS configuration (v4)
vite.config.ts         # Vite configuration for SvelteKit
```

## API Surface

- `GET /api/movies/[id]` - Retrieves a movie by internal ID with TMDB credits and trailer metadata.
- `GET /api/genres/[genreName]` - Returns movies tagged with the given genre (404 when empty).
- `GET /api/search?q=` - Case-insensitive search across stored titles and overviews.
- `GET|POST /api/streaming` - Resolves playable sources from registered streaming providers.
- `GET /api/watchlist/get` - Returns the signed-in user's watchlist.
- `POST /api/watchlist/add` / `POST /api/watchlist/remove` - Mutate the authenticated user's watchlist.
- `GET /api/auth/[...nextauth]` - NextAuth handlers (GitHub/Google OAuth, session callbacks).

Routes rely on @auth/sveltekit session middleware; unauthenticated watchlist access returns an error.

## Testing & Quality

- Run `bun test` for unit tests (Vitest + Svelte testing utilities).
- Use `bun run check` to keep TypeScript and Svelte types in sync.
- Use `bun run lint` before commits to enforce ESLint and Prettier formatting.
- Playwright is available for browser automation; run `npx playwright install` before adding E2E specs.

## Streaming Providers

Streaming resolution calls multiple unofficial providers (Vidlink, Vidsrc, TwoEmbed, EmbedSu) in priority order, returning the first successful source along with diagnostics for all providers. These providers are intended for educational or testing use. Review their terms of service and comply with local laws before deploying publicly.

## License

This project is distributed under the [MIT License](LICENSE).
