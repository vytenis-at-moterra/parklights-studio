CREATE TABLE IF NOT EXISTS comments (
  id     TEXT PRIMARY KEY,
  song   TEXT NOT NULL,
  author TEXT NOT NULL,
  text   TEXT NOT NULL,
  at     TEXT NOT NULL,
  owner  TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_at ON comments(at);
CREATE INDEX IF NOT EXISTS idx_comments_owner_at ON comments(owner, at);
