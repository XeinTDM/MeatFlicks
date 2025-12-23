-- Add folderId column to watchlist table
ALTER TABLE watchlist ADD COLUMN folderId INTEGER REFERENCES watchlist_folders(id) ON DELETE SET NULL;

-- Create watchlist_folders table
CREATE TABLE watchlist_folders (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	description TEXT,
	color TEXT,
	created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
	updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
);

-- Create watchlist_tags table
CREATE TABLE watchlist_tags (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	color TEXT,
	created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
);

-- Create watchlist_item_tags table
CREATE TABLE watchlist_item_tags (
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	movie_id TEXT NOT NULL,
	tag_id INTEGER NOT NULL,
	created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
	PRIMARY KEY (user_id, movie_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX idx_watchlist_folders_user ON watchlist_folders(user_id);
CREATE INDEX idx_watchlist_folders_name ON watchlist_folders(name);
CREATE INDEX idx_watchlist_tags_user ON watchlist_tags(user_id);
CREATE INDEX idx_watchlist_tags_name ON watchlist_tags(name);
CREATE INDEX idx_watchlist_item_tags_user ON watchlist_item_tags(user_id);
CREATE INDEX idx_watchlist_item_tags_movie ON watchlist_item_tags(movie_id);
CREATE INDEX idx_watchlist_item_tags_tag ON watchlist_item_tags(tag_id);
CREATE INDEX idx_watchlist_folder ON watchlist(folderId);
