# Advanced Content Discovery Implementation Plan

## Overview

Implement advanced content discovery features to enhance user experience and content findability on MeatFlicks.

## Features to Implement

### 1. Advanced Filtering System

- **Year Range Filter**: Filter by release year (from-to)
- **Rating Filter**: Filter by minimum rating (0-10)
- **Runtime Filter**: Filter by duration (short/medium/long or custom range)
- **Language Filter**: Filter by original language
- **Multi-Genre Filter**: Select multiple genres (AND/OR logic)

### 2. Sorting Options

- **Popularity**: Sort by view count/trending score
- **Rating**: Sort by highest/lowest rating
- **Release Date**: Sort by newest/oldest
- **Alphabetical**: Sort A-Z or Z-A
- **Runtime**: Sort by duration

### 3. Pagination & Infinite Scroll

- **Pagination**: Page-based navigation with page numbers
- **Infinite Scroll**: Load more content as user scrolls
- **Hybrid**: Initial pagination with "Load More" button

### 4. Recently Searched History

- **Local Storage**: Store recent searches (client-side)
- **Database**: Store search history per user (server-side)
- **Quick Access**: Show recent searches in search dropdown

### 5. Enhanced Browse Pages

- **Filter Panel**: Collapsible sidebar with all filters
- **Active Filters**: Display active filters as removable chips
- **Results Count**: Show total results matching filters
- **Clear All**: Reset all filters at once

## Database Schema Changes

### New Tables

```sql
-- Search history table
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters TEXT, -- JSON string of applied filters
    searched_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_search_history_user ON search_history(user_id);
CREATE INDEX idx_search_history_searched_at ON search_history(searched_at);
```

### Schema Updates

Add new fields to movies table:

- `language` TEXT (original language code)
- `popularity` REAL (popularity score from TMDB)

## Implementation Steps

### Step 1: Database Schema Updates

1. Create migration for search_history table
2. Add language and popularity columns to movies table
3. Update seed data to include new fields

### Step 2: Backend - Repository Layer

1. Extend `libraryRepository` with advanced query methods:
   - `findMoviesWithFilters(filters, sort, pagination)`
   - `countMoviesWithFilters(filters)`
2. Create `searchHistoryRepository`:
   - `addSearchHistory(userId, query, filters)`
   - `getRecentSearches(userId, limit)`
   - `clearSearchHistory(userId)`

### Step 3: Backend - API Routes

1. Update `/explore/[slug]/+page.server.ts`:
   - Accept URL search params for filters
   - Apply filters to database queries
   - Return pagination metadata
2. Create `/api/search/history` endpoint:
   - GET: Fetch recent searches
   - POST: Add new search
   - DELETE: Clear history

### Step 4: Frontend - Filter Components

1. Create `FilterPanel.svelte`:
   - Year range slider
   - Rating slider
   - Runtime selector
   - Language dropdown
   - Multi-genre selector
2. Create `ActiveFilters.svelte`:
   - Display active filters as chips
   - Remove individual filters
   - Clear all button
3. Create `SortDropdown.svelte`:
   - Sort options selector
   - Current sort indicator

### Step 5: Frontend - Pagination

1. Create `Pagination.svelte`:
   - Page numbers
   - Previous/Next buttons
   - Jump to page
2. Create `InfiniteScroll.svelte`:
   - Intersection observer
   - Load more trigger
   - Loading state

### Step 6: Frontend - Search History

1. Create `SearchHistory.svelte`:
   - Recent searches list
   - Click to apply search
   - Delete individual searches
2. Update search component:
   - Show history dropdown
   - Save searches on submit

### Step 7: Integration

1. Update explore pages to use new filter system
2. Add URL state management (search params)
3. Implement loading states
4. Add error handling

## File Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── filters/
│   │   │   ├── FilterPanel.svelte
│   │   │   ├── ActiveFilters.svelte
│   │   │   ├── YearRangeFilter.svelte
│   │   │   ├── RatingFilter.svelte
│   │   │   ├── RuntimeFilter.svelte
│   │   │   ├── LanguageFilter.svelte
│   │   │   └── MultiGenreFilter.svelte
│   │   ├── pagination/
│   │   │   ├── Pagination.svelte
│   │   │   └── InfiniteScroll.svelte
│   │   └── search/
│   │       └── SearchHistory.svelte
│   ├── server/
│   │   ├── db/
│   │   │   └── schema.ts (updated)
│   │   └── repositories/
│   │       ├── library.repository.ts (updated)
│   │       └── search-history.repository.ts (new)
│   └── types/
│       ├── filters.ts (new)
│       └── pagination.ts (new)
├── routes/
│   ├── (app)/
│   │   └── explore/
│   │       └── [slug]/
│   │           ├── +page.server.ts (updated)
│   │           └── +page.svelte (updated)
│   └── api/
│       └── search/
│           └── history/
│               └── +server.ts (new)
└── drizzle/
    └── migrations/
        └── XXXX_add_search_history.sql (new)
```

## Types & Interfaces

```typescript
// filters.ts
export interface MovieFilters {
	yearFrom?: number;
	yearTo?: number;
	minRating?: number;
	maxRating?: number;
	runtimeMin?: number;
	runtimeMax?: number;
	language?: string;
	genres?: string[]; // genre IDs or names
	genreMode?: 'AND' | 'OR'; // How to combine genres
}

export interface SortOptions {
	field: 'popularity' | 'rating' | 'releaseDate' | 'title' | 'runtime';
	order: 'asc' | 'desc';
}

// pagination.ts
export interface PaginationParams {
	page: number;
	pageSize: number;
}

export interface PaginationMetadata {
	currentPage: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
	items: T[];
	pagination: PaginationMetadata;
}
```

## URL Search Params Structure

```
/explore/movies?
  yearFrom=2020&
  yearTo=2024&
  minRating=7.0&
  genres=action,thriller&
  genreMode=AND&
  sort=rating&
  order=desc&
  page=1&
  pageSize=20
```

## Testing Checklist

- [ ] Filters work independently
- [ ] Filters work in combination
- [ ] Sorting works with filters
- [ ] Pagination maintains filter state
- [ ] URL state updates correctly
- [ ] Browser back/forward works
- [ ] Search history saves correctly
- [ ] Search history loads on page load
- [ ] Clear filters resets to default state
- [ ] Mobile responsive design
- [ ] Loading states display correctly
- [ ] Error states handle gracefully

## Performance Considerations

1. **Database Indexing**: Ensure proper indexes on filterable columns
2. **Query Optimization**: Use efficient SQL queries with proper joins
3. **Caching**: Cache filter options (genres, languages)
4. **Debouncing**: Debounce filter changes to reduce API calls
5. **Lazy Loading**: Load filter options on demand
6. **Virtual Scrolling**: For large result sets

## Accessibility

1. **Keyboard Navigation**: All filters keyboard accessible
2. **Screen Reader**: Proper ARIA labels
3. **Focus Management**: Logical focus order
4. **Announcements**: Announce filter changes and results count

## Implementation Status

### ✅ Completed (Backend & Components)

- [x] Database schema updates (migration created)
- [x] Search history table and repository
- [x] `findMoviesWithFilters()` method in library repository
- [x] `countMoviesWithFilters()` method
- [x] `buildOrderByClause()` for dynamic sorting
- [x] All filter components (FilterPanel, YearRangeFilter, RatingFilter, RuntimeFilter, LanguageFilter, MultiGenreFilter)
- [x] ActiveFilters component
- [x] Pagination component
- [x] Type definitions (filters.ts, pagination.ts)

### ⚠️ Partially Completed

- [x] Search history repository (backend complete)
- [ ] Search history API endpoint (`/api/search/history/+server.ts`)
- [ ] Search history UI component (`SearchHistory.svelte`)
- [ ] Integration with global search component

### ❌ Not Yet Implemented

- [ ] Explore page integration (filters not connected to explore pages)
- [ ] URL search params parsing in `+page.server.ts`
- [ ] SortDropdown component (mentioned in plan but not created)
- [ ] InfiniteScroll component (alternative to pagination)
- [ ] URL state management for filters
- [ ] Loading states for filter operations
- [ ] Error handling for filter queries

## Code Examples

### Using Filters in Explore Page

```typescript
// +page.server.ts
import { libraryRepository } from '$lib/server';
import type { MovieFilters, SortOptions } from '$lib/types/filters';
import type { PaginationParams } from '$lib/types/pagination';

export const load: PageServerLoad = async ({ url, params }) => {
	// Parse filters from URL
	const filters: MovieFilters = {
		yearFrom: url.searchParams.get('yearFrom')
			? Number(url.searchParams.get('yearFrom'))
			: undefined,
		yearTo: url.searchParams.get('yearTo') ? Number(url.searchParams.get('yearTo')) : undefined,
		minRating: url.searchParams.get('minRating')
			? Number(url.searchParams.get('minRating'))
			: undefined,
		genres: url.searchParams.get('genres')?.split(',').filter(Boolean),
		genreMode: (url.searchParams.get('genreMode') as 'AND' | 'OR') || 'OR'
		// ... other filters
	};

	const sort: SortOptions = {
		field: (url.searchParams.get('sort') as any) || 'popularity',
		order: (url.searchParams.get('order') as 'asc' | 'desc') || 'desc'
	};

	const pagination: PaginationParams = {
		page: Number(url.searchParams.get('page')) || 1,
		pageSize: Number(url.searchParams.get('pageSize')) || 20
	};

	const result = await libraryRepository.findMoviesWithFilters(filters, sort, pagination);

	return {
		movies: result.items,
		pagination: result.pagination,
		filters,
		sort
	};
};
```

### Search History API Endpoint

```typescript
// routes/api/search/history/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchHistoryRepository } from '$lib/server/repositories/search-history.repository';
import { validateSession } from '$lib/server/auth';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await validateSession(locals);
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const searches = await searchHistoryRepository.getRecentSearches(session.userId, 10);
	return json({ searches });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await validateSession(locals);
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { query, filters } = await request.json();
	await searchHistoryRepository.addSearch(session.userId, query, filters);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const session = await validateSession(locals);
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	await searchHistoryRepository.clearHistory(session.userId);
	return json({ success: true });
};
```

## Future Enhancements

1. **Saved Filters**: Save filter presets
2. **Filter Presets**: Pre-configured popular filters
3. **Advanced Search**: Boolean operators, exact match
4. **Filter Analytics**: Track popular filter combinations
5. **Smart Filters**: AI-suggested filters based on viewing history
6. **Infinite Scroll**: Alternative to pagination for better UX
7. **Filter URL Sharing**: Share filtered views with others
8. **Filter History**: Remember last used filters per user
