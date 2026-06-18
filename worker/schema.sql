DROP TABLE IF EXISTS posts;

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  topic_norm TEXT NOT NULL,
  -- 4 軸の独立連続値 (0..1) - 個人の色覚を多次元で記録
  artist_protan REAL NOT NULL DEFAULT 0,
  artist_deutan REAL NOT NULL DEFAULT 0,
  artist_tritan REAL NOT NULL DEFAULT 0,
  artist_macular REAL NOT NULL DEFAULT 0,
  comment TEXT,
  image_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_topic_norm ON posts(topic_norm);
CREATE INDEX idx_created_at ON posts(created_at DESC);
