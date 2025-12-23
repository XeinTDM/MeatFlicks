-- Migration to add metadata columns to movies table
BEGIN;

-- Add new metadata columns to movies table
ALTER TABLE movies ADD COLUMN trailerUrl TEXT;
ALTER TABLE movies ADD COLUMN imdbId TEXT;
ALTER TABLE movies ADD COLUMN canonicalPath TEXT;
ALTER TABLE movies ADD COLUMN addedAt INTEGER;
ALTER TABLE movies ADD COLUMN mediaType TEXT NOT NULL DEFAULT 'movie';

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_movies_mediaType ON movies(mediaType);
CREATE INDEX IF NOT EXISTS idx_movies_addedAt ON movies(addedAt);
CREATE INDEX IF NOT EXISTS idx_movies_imdbId ON movies(imdbId);

COMMIT;
