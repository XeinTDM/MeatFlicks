-- Create TV shows table for better show management
CREATE TABLE IF NOT EXISTS tv_shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdb_id INTEGER NOT NULL UNIQUE,
    imdb_id TEXT,
    title TEXT NOT NULL,
    overview TEXT,
    poster_path TEXT,
    backdrop_path TEXT,
    first_air_date TEXT,
    rating REAL,
    episode_run_time INTEGER,
    number_of_seasons INTEGER,
    number_of_episodes INTEGER,
    status TEXT, -- 'Returning Series', 'Ended', 'Canceled', etc.
    origin_country TEXT, -- JSON array of country codes
    production_companies TEXT, -- JSON array of company objects
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tv_show_id INTEGER NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    overview TEXT,
    poster_path TEXT,
    air_date TEXT,
    episode_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(tv_show_id, season_number)
);

-- Create episodes table for detailed episode tracking
CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tv_show_id INTEGER NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    overview TEXT,
    still_path TEXT,
    air_date TEXT,
    runtime_minutes INTEGER,
    tmdb_id INTEGER,
    imdb_id TEXT,
    guest_stars TEXT, -- JSON array of guest star objects
    crew TEXT, -- JSON array of crew objects
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(season_id, episode_number)
);

-- Create episode watch status table for user tracking
CREATE TABLE IF NOT EXISTS episode_watch_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    watched BOOLEAN NOT NULL DEFAULT FALSE,
    watch_time INTEGER DEFAULT 0, -- seconds watched
    total_time INTEGER DEFAULT 0, -- total episode duration in seconds
    completed_at INTEGER, -- timestamp when marked as completed
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(user_id, episode_id)
);

-- Create season watch status table
CREATE TABLE IF NOT EXISTS season_watch_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    episodes_watched INTEGER NOT NULL DEFAULT 0,
    total_episodes INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(user_id, season_id)
);

-- Create TV show watch status table
CREATE TABLE IF NOT EXISTS tv_show_watch_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tv_show_id INTEGER NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'watching', -- 'watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'
    seasons_completed INTEGER NOT NULL DEFAULT 0,
    total_seasons INTEGER NOT NULL DEFAULT 0,
    episodes_watched INTEGER NOT NULL DEFAULT 0,
    total_episodes INTEGER NOT NULL DEFAULT 0,
    rating REAL CHECK (rating >= 0 AND rating <= 10),
    notes TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(user_id, tv_show_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tv_shows_tmdb_id ON tv_shows(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_tv_shows_imdb_id ON tv_shows(imdb_id);
CREATE INDEX IF NOT EXISTS idx_tv_shows_title ON tv_shows(title);
CREATE INDEX IF NOT EXISTS idx_tv_shows_first_air_date ON tv_shows(first_air_date);

CREATE INDEX IF NOT EXISTS idx_seasons_tv_show_id ON seasons(tv_show_id);
CREATE INDEX IF NOT EXISTS idx_seasons_season_number ON seasons(season_number);
CREATE INDEX IF NOT EXISTS idx_seasons_air_date ON seasons(air_date);

CREATE INDEX IF NOT EXISTS idx_episodes_tv_show_id ON episodes(tv_show_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_episodes_episode_number ON episodes(episode_number);
CREATE INDEX IF NOT EXISTS idx_episodes_air_date ON episodes(air_date);
CREATE INDEX IF NOT EXISTS idx_episodes_tmdb_id ON episodes(tmdb_id);

CREATE INDEX IF NOT EXISTS idx_episode_watch_status_user_id ON episode_watch_status(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_watch_status_episode_id ON episode_watch_status(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_watch_status_watched ON episode_watch_status(watched);

CREATE INDEX IF NOT EXISTS idx_season_watch_status_user_id ON season_watch_status(user_id);
CREATE INDEX IF NOT EXISTS idx_season_watch_status_season_id ON season_watch_status(season_id);

CREATE INDEX IF NOT EXISTS idx_tv_show_watch_status_user_id ON tv_show_watch_status(user_id);
CREATE INDEX IF NOT EXISTS idx_tv_show_watch_status_tv_show_id ON tv_show_watch_status(tv_show_id);
CREATE INDEX IF NOT EXISTS idx_tv_show_watch_status_status ON tv_show_watch_status(status);
