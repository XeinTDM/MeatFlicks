-- Update TV series that are currently marked as movies
-- This identifies TV series by checking if they have seasons data from TMDB

-- First, let's see what we're working with
SELECT id, title, tmdbId, mediaType, imdbId 
FROM movies 
WHERE mediaType = 'movie' 
LIMIT 10;

-- To fix Stranger Things specifically (TMDB ID 66732):
-- UPDATE movies SET mediaType = 'tv' WHERE tmdbId = 66732;

-- To fix all TV series, you would need to check against TMDB API
-- or manually identify them. For now, let's just fix Stranger Things:
UPDATE movies SET mediaType = 'tv' WHERE imdbId = 'tt4574334';
