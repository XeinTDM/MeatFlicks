-- Add people table for storing actor, director, and crew information
CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdbId INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    biography TEXT,
    birthday TEXT, -- ISO date string
    deathday TEXT, -- ISO date string
    placeOfBirth TEXT,
    profilePath TEXT,
    popularity REAL,
    knownForDepartment TEXT, -- 'Acting', 'Directing', etc.
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Create indexes for people table
CREATE INDEX IF NOT EXISTS idx_people_tmdbId ON people(tmdbId);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
CREATE INDEX IF NOT EXISTS idx_people_popularity ON people(popularity);
CREATE INDEX IF NOT EXISTS idx_people_knownForDepartment ON people(knownForDepartment);

-- Add movie_people table for linking movies to people (actors, directors, etc.)
CREATE TABLE IF NOT EXISTS movie_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movieId TEXT NOT NULL,
    personId INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'actor', 'director', 'writer', 'producer', etc.
    character TEXT, -- For actors
    job TEXT, -- For crew (e.g., 'Director', 'Screenplay')
    "order" INTEGER, -- For cast ordering
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    FOREIGN KEY (movieId) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (personId) REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (movieId, personId, role)
);

-- Create indexes for movie_people table
CREATE INDEX IF NOT EXISTS idx_movie_people_movie ON movie_people(movieId);
CREATE INDEX IF NOT EXISTS idx_movie_people_person ON movie_people(personId);
CREATE INDEX IF NOT EXISTS idx_movie_people_role ON movie_people(role);
CREATE INDEX IF NOT EXISTS idx_movie_people_order ON movie_people("order");

-- Create full-text search virtual table for people
CREATE VIRTUAL TABLE IF NOT EXISTS people_fts USING fts5(
    name,
    knownForDepartment,
    content='people',
    content_rowid='id'
);

-- Populate people_fts with existing data
INSERT INTO people_fts(people_fts) VALUES('rebuild');

-- Create triggers to keep people_fts in sync
CREATE TRIGGER IF NOT EXISTS people_fts_insert AFTER INSERT ON people BEGIN
    INSERT INTO people_fts(rowid, name, knownForDepartment) VALUES (new.id, new.name, new.knownForDepartment);
END;

CREATE TRIGGER IF NOT EXISTS people_fts_delete AFTER DELETE ON people BEGIN
    INSERT INTO people_fts(people_fts, rowid, name, knownForDepartment) VALUES('delete', old.id, old.name, old.knownForDepartment);
END;

CREATE TRIGGER IF NOT EXISTS people_fts_update AFTER UPDATE ON people BEGIN
    INSERT INTO people_fts(people_fts, rowid, name, knownForDepartment) VALUES('delete', old.id, old.name, old.knownForDepartment);
    INSERT INTO people_fts(rowid, name, knownForDepartment) VALUES (new.id, new.name, new.knownForDepartment);
END;
