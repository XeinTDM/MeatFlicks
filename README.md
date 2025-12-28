# MeatFlicks

MeatFlicks is a SvelteKit 2 (Svelte 5 runes) web application for exploring and streaming movies and TV series. It stores a curated library in a local SQLite database with FTS5 full-text search, augments records with TMDB metadata, resolves playable sources from multiple third-party streaming providers, and lets authenticated users maintain a personal watchlist.

## Features

- Server-rendered Svelte 5 experience with Tailwind CSS v4 styling and responsive design.
- Library ingestion backed by SQLite + TMDB enrichment (cast, trailers, artwork).
- Streaming resolver that queries Vidlink, Vidsrc, TwoEmbed, and EmbedSu, with provider prioritisation and diagnostics.
- Authentication with GitHub and Google OAuth via Lucia and JWT sessions.
- Personal watchlist controls persisted alongside the catalog in SQLite and exposed through `/api/watchlist`.
- Global search endpoint (`/api/search`) with debounced UI, category/collection browsing, and light/dark theme toggle.

## Tech Stack

- SvelteKit 2 / Svelte 5 runes mode / TypeScript (strict)
- Tailwind CSS v4 with utility-first design
- Bun for runtime, dependency management, and scripts
- SQLite (better-sqlite3) with FTS5 full-text search
- Lucia for authentication with OAuth flows
- Zod validation for configuration, Lucide icons, Ofetch for outbound requests, Vitest/Playwright for testing

## Prerequisites

- Bun >= 1.1.0 (installs dependencies and runs scripts)
- Node.js >= 18 (Bun still relies on system Node toolchain for some utilities)
- TMDB API key
- OAuth credentials for GitHub (required) and optionally Google
- Secrets store or `.env` file containing the configuration below (never commit production secrets)

## Getting Started

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create a `.env` file (or configure your secrets manager) using the variables listed below.

3. Start the development server:

   ```bash
   bun dev
   ```

   The app will be available on the host/port reported by Vite (default `http://localhost:5173`). The SQLite database file is created automatically on first run (defaults to `data/meatflicks.db`; override with `SQLITE_DB_PATH` if desired).

## Environment Variables

## Commands

| Command         | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `bun dev`       | Start the SvelteKit development server.                           |
| `bun run build` | Create a production build.                                        |
| `bun preview`   | Preview the production build locally.                             |
| `bun run lint`  | Run Prettier check and ESLint.                                    |
| `bun run check` | Run SvelteKit sync and type-checking (svelte-check + TypeScript). |
| `bun test`      | Execute Vitest unit tests (`--run` configured in package).        |

## Testing & Quality

- Run `bun test` for unit tests (Vitest + Svelte testing utilities).
- Use `bun run check` to keep TypeScript and Svelte types in sync.
- Use `bun run lint` before commits to enforce ESLint and Prettier formatting.
- Playwright is available for browser automation; run `npx playwright install` before adding E2E specs.

## Streaming Providers

Streaming resolution calls multiple unofficial providers (Vidlink, Vidsrc, TwoEmbed, EmbedSu) in priority order, returning the first successful source along with diagnostics for all providers. These providers are intended for educational or testing use. Review their terms of service and comply with local laws before deploying publicly.

## License

This project is distributed under the [MIT License](LICENSE).
