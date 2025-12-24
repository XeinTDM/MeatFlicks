-- Add composite indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_movies_rating_release_popularity ON movies(rating DESC, releaseDate DESC, popularity DESC);
CREATE INDEX IF NOT EXISTS idx_movies_release_rating_title ON movies(releaseDate DESC, rating DESC, title COLLATE NOCASE ASC);
CREATE INDEX IF NOT EXISTS idx_movies_popularity_rating ON movies(popularity DESC, rating DESC);

-- Add partial index for active content (exclude adult content if applicable)
CREATE INDEX IF NOT EXISTS idx_movies_active_content ON movies(id, title, rating, releaseDate, popularity) WHERE (is4K = 0 OR is4K IS NULL);

-- Optimize FTS table with better configuration if possible
