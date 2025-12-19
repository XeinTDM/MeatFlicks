-- Add search history table for tracking user searches
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    query TEXT NOT NULL,
    filters TEXT, -- JSON string of applied filters
    searched_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_searched_at ON search_history(searched_at);

-- Add new columns to movies table for advanced filtering
ALTER TABLE movies ADD COLUMN language TEXT;
ALTER TABLE movies ADD COLUMN popularity REAL;

-- Create indexes for new filterable columns
CREATE INDEX IF NOT EXISTS idx_movies_language ON movies(language);
CREATE INDEX IF NOT EXISTS idx_movies_popularity ON movies(popularity);
CREATE INDEX IF NOT EXISTS idx_movies_releaseDate ON movies(releaseDate);
CREATE INDEX IF NOT EXISTS idx_movies_durationMinutes ON movies(durationMinutes);
