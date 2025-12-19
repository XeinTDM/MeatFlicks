-- Add playback_progress table for tracking user playback position
CREATE TABLE IF NOT EXISTS playback_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    progress INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    season_number INTEGER,
    episode_number INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_playback_progress_user ON playback_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_playback_progress_media ON playback_progress(media_id);
CREATE INDEX IF NOT EXISTS idx_playback_progress_updated ON playback_progress(updated_at);


