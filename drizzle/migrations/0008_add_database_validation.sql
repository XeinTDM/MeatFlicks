-- Add database-level validation triggers
-- Note: SQLite has limited CHECK constraint support, so we use triggers for complex validation

-- Create a function to validate movie data
CREATE TRIGGER validate_movie_insert BEFORE INSERT ON movies
BEGIN
    -- Title validation
    SELECT CASE
        WHEN length(trim(NEW.title)) = 0 THEN
            RAISE(ABORT, 'Movie title cannot be empty')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdbId <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- Rating validation
    SELECT CASE
        WHEN NEW.rating IS NOT NULL AND (NEW.rating < 0 OR NEW.rating > 10) THEN
            RAISE(ABORT, 'Rating must be between 0 and 10')
    END;

    -- Duration validation
    SELECT CASE
        WHEN NEW.durationMinutes IS NOT NULL AND NEW.durationMinutes <= 0 THEN
            RAISE(ABORT, 'Duration must be a positive number')
    END;

    -- Media type validation
    SELECT CASE
        WHEN NEW.mediaType NOT IN ('movie', 'tv', 'anime') THEN
            RAISE(ABORT, 'Media type must be movie, tv, or anime')
    END;

    -- IMDB ID validation
    SELECT CASE
        WHEN NEW.imdbId IS NOT NULL AND NOT (NEW.imdbId REGEXP '^tt\d{7,8}$') THEN
            RAISE(ABORT, 'IMDB ID must be in format tt1234567 or tt12345678')
    END;

    -- URL validation
    SELECT CASE
        WHEN NEW.posterPath IS NOT NULL AND NOT (NEW.posterPath LIKE 'https://%') THEN
            RAISE(ABORT, 'Poster path must use HTTPS protocol')
        WHEN NEW.backdropPath IS NOT NULL AND NOT (NEW.backdropPath LIKE 'https://%') THEN
            RAISE(ABORT, 'Backdrop path must use HTTPS protocol')
        WHEN NEW.trailerUrl IS NOT NULL AND NOT (NEW.trailerUrl LIKE 'https://%') THEN
            RAISE(ABORT, 'Trailer URL must use HTTPS protocol')
    END;
END;

CREATE TRIGGER validate_movie_update BEFORE UPDATE ON movies
BEGIN
    -- Title validation
    SELECT CASE
        WHEN length(trim(NEW.title)) = 0 THEN
            RAISE(ABORT, 'Movie title cannot be empty')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdbId <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- Rating validation
    SELECT CASE
        WHEN NEW.rating IS NOT NULL AND (NEW.rating < 0 OR NEW.rating > 10) THEN
            RAISE(ABORT, 'Rating must be between 0 and 10')
    END;

    -- Duration validation
    SELECT CASE
        WHEN NEW.durationMinutes IS NOT NULL AND NEW.durationMinutes <= 0 THEN
            RAISE(ABORT, 'Duration must be a positive number')
    END;

    -- Media type validation
    SELECT CASE
        WHEN NEW.mediaType NOT IN ('movie', 'tv', 'anime') THEN
            RAISE(ABORT, 'Media type must be movie, tv, or anime')
    END;

    -- IMDB ID validation
    SELECT CASE
        WHEN NEW.imdbId IS NOT NULL AND NOT (NEW.imdbId REGEXP '^tt\d{7,8}$') THEN
            RAISE(ABORT, 'IMDB ID must be in format tt1234567 or tt12345678')
    END;

    -- URL validation
    SELECT CASE
        WHEN NEW.posterPath IS NOT NULL AND NOT (NEW.posterPath LIKE 'https://%') THEN
            RAISE(ABORT, 'Poster path must use HTTPS protocol')
        WHEN NEW.backdropPath IS NOT NULL AND NOT (NEW.backdropPath LIKE 'https://%') THEN
            RAISE(ABORT, 'Backdrop path must use HTTPS protocol')
        WHEN NEW.trailerUrl IS NOT NULL AND NOT (NEW.trailerUrl LIKE 'https://%') THEN
            RAISE(ABORT, 'Trailer URL must use HTTPS protocol')
    END;
END;

-- TV Shows validation triggers
CREATE TRIGGER validate_tv_show_insert BEFORE INSERT ON tv_shows
BEGIN
    -- Title validation
    SELECT CASE
        WHEN length(trim(NEW.title)) = 0 THEN
            RAISE(ABORT, 'TV show title cannot be empty')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdb_id <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- Rating validation
    SELECT CASE
        WHEN NEW.rating IS NOT NULL AND (NEW.rating < 0 OR NEW.rating > 10) THEN
            RAISE(ABORT, 'Rating must be between 0 and 10')
    END;

    -- Episode runtime validation
    SELECT CASE
        WHEN NEW.episode_run_time IS NOT NULL AND NEW.episode_run_time <= 0 THEN
            RAISE(ABORT, 'Episode runtime must be a positive number')
    END;

    -- Seasons and episodes count validation
    SELECT CASE
        WHEN NEW.number_of_seasons IS NOT NULL AND NEW.number_of_seasons < 0 THEN
            RAISE(ABORT, 'Number of seasons cannot be negative')
        WHEN NEW.number_of_episodes IS NOT NULL AND NEW.number_of_episodes < 0 THEN
            RAISE(ABORT, 'Number of episodes cannot be negative')
    END;

    -- IMDB ID validation
    SELECT CASE
        WHEN NEW.imdb_id IS NOT NULL AND NOT (NEW.imdb_id REGEXP '^tt\d{7,8}$') THEN
            RAISE(ABORT, 'IMDB ID must be in format tt1234567 or tt12345678')
    END;

    -- URL validation
    SELECT CASE
        WHEN NEW.poster_path IS NOT NULL AND NOT (NEW.poster_path LIKE 'https://%') THEN
            RAISE(ABORT, 'Poster path must use HTTPS protocol')
        WHEN NEW.backdrop_path IS NOT NULL AND NOT (NEW.backdrop_path LIKE 'https://%') THEN
            RAISE(ABORT, 'Backdrop path must use HTTPS protocol')
    END;
END;

CREATE TRIGGER validate_tv_show_update BEFORE UPDATE ON tv_shows
BEGIN
    -- Title validation
    SELECT CASE
        WHEN length(trim(NEW.title)) = 0 THEN
            RAISE(ABORT, 'TV show title cannot be empty')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdb_id <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- Rating validation
    SELECT CASE
        WHEN NEW.rating IS NOT NULL AND (NEW.rating < 0 OR NEW.rating > 10) THEN
            RAISE(ABORT, 'Rating must be between 0 and 10')
    END;

    -- Episode runtime validation
    SELECT CASE
        WHEN NEW.episode_run_time IS NOT NULL AND NEW.episode_run_time <= 0 THEN
            RAISE(ABORT, 'Episode runtime must be a positive number')
    END;

    -- Seasons and episodes count validation
    SELECT CASE
        WHEN NEW.number_of_seasons IS NOT NULL AND NEW.number_of_seasons < 0 THEN
            RAISE(ABORT, 'Number of seasons cannot be negative')
        WHEN NEW.number_of_episodes IS NOT NULL AND NEW.number_of_episodes < 0 THEN
            RAISE(ABORT, 'Number of episodes cannot be negative')
    END;

    -- IMDB ID validation
    SELECT CASE
        WHEN NEW.imdb_id IS NOT NULL AND NOT (NEW.imdb_id REGEXP '^tt\d{7,8}$') THEN
            RAISE(ABORT, 'IMDB ID must be in format tt1234567 or tt12345678')
    END;

    -- URL validation
    SELECT CASE
        WHEN NEW.poster_path IS NOT NULL AND NOT (NEW.poster_path LIKE 'https://%') THEN
            RAISE(ABORT, 'Poster path must use HTTPS protocol')
        WHEN NEW.backdrop_path IS NOT NULL AND NOT (NEW.backdrop_path LIKE 'https://%') THEN
            RAISE(ABORT, 'Backdrop path must use HTTPS protocol')
    END;
END;

-- Episodes validation triggers
CREATE TRIGGER validate_episode_insert BEFORE INSERT ON episodes
BEGIN
    -- Name validation
    SELECT CASE
        WHEN length(trim(NEW.name)) = 0 THEN
            RAISE(ABORT, 'Episode name cannot be empty')
    END;

    -- Episode number validation
    SELECT CASE
        WHEN NEW.episode_number <= 0 THEN
            RAISE(ABORT, 'Episode number must be a positive integer')
    END;

    -- Runtime validation
    SELECT CASE
        WHEN NEW.runtime_minutes IS NOT NULL AND NEW.runtime_minutes <= 0 THEN
            RAISE(ABORT, 'Runtime must be a positive number')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdb_id IS NOT NULL AND NEW.tmdb_id <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- IMDB ID validation
    SELECT CASE
        WHEN NEW.imdb_id IS NOT NULL AND NOT (NEW.imdb_id REGEXP '^tt\d{7,8}$') THEN
            RAISE(ABORT, 'IMDB ID must be in format tt1234567 or tt12345678')
    END;

    -- Still path URL validation
    SELECT CASE
        WHEN NEW.still_path IS NOT NULL AND NOT (NEW.still_path LIKE 'https://%') THEN
            RAISE(ABORT, 'Still path must use HTTPS protocol')
    END;
END;

CREATE TRIGGER validate_episode_update BEFORE UPDATE ON episodes
BEGIN
    -- Name validation
    SELECT CASE
        WHEN length(trim(NEW.name)) = 0 THEN
            RAISE(ABORT, 'Episode name cannot be empty')
    END;

    -- Episode number validation
    SELECT CASE
        WHEN NEW.episode_number <= 0 THEN
            RAISE(ABORT, 'Episode number must be a positive integer')
    END;

    -- Runtime validation
    SELECT CASE
        WHEN NEW.runtime_minutes IS NOT NULL AND NEW.runtime_minutes <= 0 THEN
            RAISE(ABORT, 'Runtime must be a positive number')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdb_id IS NOT NULL AND NEW.tmdb_id <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- IMDB ID validation
    SELECT CASE
        WHEN NEW.imdb_id IS NOT NULL AND NOT (NEW.imdb_id REGEXP '^tt\d{7,8}$') THEN
            RAISE(ABORT, 'IMDB ID must be in format tt1234567 or tt12345678')
    END;

    -- Still path URL validation
    SELECT CASE
        WHEN NEW.still_path IS NOT NULL AND NOT (NEW.still_path LIKE 'https://%') THEN
            RAISE(ABORT, 'Still path must use HTTPS protocol')
    END;
END;

-- People validation triggers
CREATE TRIGGER validate_person_insert BEFORE INSERT ON people
BEGIN
    -- Name validation
    SELECT CASE
        WHEN length(trim(NEW.name)) = 0 THEN
            RAISE(ABORT, 'Person name cannot be empty')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdbId <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- Popularity validation
    SELECT CASE
        WHEN NEW.popularity IS NOT NULL AND NEW.popularity < 0 THEN
            RAISE(ABORT, 'Popularity cannot be negative')
    END;

    -- Profile path URL validation
    SELECT CASE
        WHEN NEW.profilePath IS NOT NULL AND NOT (NEW.profilePath LIKE 'https://%') THEN
            RAISE(ABORT, 'Profile path must use HTTPS protocol')
    END;
END;

CREATE TRIGGER validate_person_update BEFORE UPDATE ON people
BEGIN
    -- Name validation
    SELECT CASE
        WHEN length(trim(NEW.name)) = 0 THEN
            RAISE(ABORT, 'Person name cannot be empty')
    END;

    -- TMDB ID validation
    SELECT CASE
        WHEN NEW.tmdbId <= 0 THEN
            RAISE(ABORT, 'TMDB ID must be a positive integer')
    END;

    -- Popularity validation
    SELECT CASE
        WHEN NEW.popularity IS NOT NULL AND NEW.popularity < 0 THEN
            RAISE(ABORT, 'Popularity cannot be negative')
    END;

    -- Profile path URL validation
    SELECT CASE
        WHEN NEW.profilePath IS NOT NULL AND NOT (NEW.profilePath LIKE 'https://%') THEN
            RAISE(ABORT, 'Profile path must use HTTPS protocol')
    END;
END;

-- Playback progress validation triggers
CREATE TRIGGER validate_playback_progress_insert BEFORE INSERT ON playback_progress
BEGIN
    -- Progress validation
    SELECT CASE
        WHEN NEW.progress < 0 OR NEW.progress > NEW.duration THEN
            RAISE(ABORT, 'Progress must be between 0 and duration')
    END;

    -- Duration validation
    SELECT CASE
        WHEN NEW.duration <= 0 THEN
            RAISE(ABORT, 'Duration must be a positive number')
    END;

    -- Media type validation
    SELECT CASE
        WHEN NEW.media_type NOT IN ('movie', 'tv', 'episode') THEN
            RAISE(ABORT, 'Media type must be movie, tv, or episode')
    END;

    -- Season/Episode validation for TV content
    SELECT CASE
        WHEN NEW.media_type = 'episode' AND (NEW.season_number IS NULL OR NEW.episode_number IS NULL) THEN
            RAISE(ABORT, 'Season and episode numbers are required for episode media type')
    END;
END;

CREATE TRIGGER validate_playback_progress_update BEFORE UPDATE ON playback_progress
BEGIN
    -- Progress validation
    SELECT CASE
        WHEN NEW.progress < 0 OR NEW.progress > NEW.duration THEN
            RAISE(ABORT, 'Progress must be between 0 and duration')
    END;

    -- Duration validation
    SELECT CASE
        WHEN NEW.duration <= 0 THEN
            RAISE(ABORT, 'Duration must be a positive number')
    END;

    -- Media type validation
    SELECT CASE
        WHEN NEW.media_type NOT IN ('movie', 'tv', 'episode') THEN
            RAISE(ABORT, 'Media type must be movie, tv, or episode')
    END;

    -- Season/Episode validation for TV content
    SELECT CASE
        WHEN NEW.media_type = 'episode' AND (NEW.season_number IS NULL OR NEW.episode_number IS NULL) THEN
            RAISE(ABORT, 'Season and episode numbers are required for episode media type')
    END;
END;

-- Search history validation triggers
CREATE TRIGGER validate_search_history_insert BEFORE INSERT ON search_history
BEGIN
    -- Query validation
    SELECT CASE
        WHEN length(trim(NEW.query)) = 0 THEN
            RAISE(ABORT, 'Search query cannot be empty')
        WHEN length(trim(NEW.query)) > 200 THEN
            RAISE(ABORT, 'Search query cannot exceed 200 characters')
    END;
END;

CREATE TRIGGER validate_search_history_update BEFORE UPDATE ON search_history
BEGIN
    -- Query validation
    SELECT CASE
        WHEN length(trim(NEW.query)) = 0 THEN
            RAISE(ABORT, 'Search query cannot be empty')
        WHEN length(trim(NEW.query)) > 200 THEN
            RAISE(ABORT, 'Search query cannot exceed 200 characters')
    END;
END;

-- User validation triggers for GitHub OAuth
CREATE TRIGGER validate_user_insert BEFORE INSERT ON users
BEGIN
    -- Username validation for GitHub OAuth (1-39 characters, alphanumeric + hyphens)
    SELECT CASE
        WHEN length(trim(NEW.username)) < 1 OR length(trim(NEW.username)) > 39 THEN
            RAISE(ABORT, 'Username must be between 1 and 39 characters')
        WHEN NOT (NEW.username REGEXP '^[a-zA-Z0-9-]+$') THEN
            RAISE(ABORT, 'Username can only contain letters, numbers, and hyphens')
    END;
END;

CREATE TRIGGER validate_user_update BEFORE UPDATE ON users
BEGIN
    -- Username validation for GitHub OAuth (1-39 characters, alphanumeric + hyphens)
    SELECT CASE
        WHEN length(trim(NEW.username)) < 1 OR length(trim(NEW.username)) > 39 THEN
            RAISE(ABORT, 'Username must be between 1 and 39 characters')
        WHEN NOT (NEW.username REGEXP '^[a-zA-Z0-9-]+$') THEN
            RAISE(ABORT, 'Username can only contain letters, numbers, and hyphens')
    END;
END;
